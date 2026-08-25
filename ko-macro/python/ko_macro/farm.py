"""Otomatik farm döngüsü: hedef seç → vur → öldüğünü gör → yağmala → tekrar.

İki çalışma kipi var:

* **Geri beslemeli** (``farm.target_bar`` tanımlıysa): ekranın üstündeki hedef
  can barı okunur. Tab bir şey seçti mi, can azalıyor mu, mob öldü mü —
  hepsi buradan anlaşılır. Sabit süre beklenmez, mob düşer düşmez yeni hedefe
  geçilir; menzil dışındaysan hedef bırakılır. Oyunun hafızasına dokunulmaz,
  sadece piksel okunur.
* **Kör** (bar tanımlı değilse): hedefe ``engage_seconds`` kadar saldırılır ve
  öldüğü varsayılır. Basit ama israflı; mümkünse bar tanımla.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable

from .clock import Clock
from .config import Combo, FarmConfig
from .sequence import ComboRunner
from .transport import Transport
from .vitals import DamageWatch, TargetMonitor

log = logging.getLogger(__name__)

#: Her zaman devam et.
ALWAYS: Callable[[], bool] = lambda: True


@dataclass
class FarmStats:
    """Döngü sayaçları."""

    cycles: int = 0
    kills: int = 0
    combos: int = 0
    misses: int = 0        # hedef bulunamayan turlar
    abandoned: int = 0     # hasar girmediği için bırakılan hedefler
    started_at: float = 0.0
    stopped_at: float | None = None

    def elapsed(self, now: float) -> float:
        return (self.stopped_at or now) - self.started_at

    def kills_per_hour(self, now: float) -> float:
        seconds = self.elapsed(now)
        return (self.kills / seconds * 3600.0) if seconds > 0 else 0.0


@dataclass
class FarmLoop:
    """Hedefleme/saldırı döngüsü."""

    config: FarmConfig
    runner: ComboRunner
    transport: Transport
    clock: Clock
    combo: Combo | None = None
    #: Hedef can barı okuyucusu; ``None`` ise kör kipte çalışır.
    target: TargetMonitor | None = None
    #: Bir mob öldüğünde çağrılır (doğuş takibine kayıt için).
    on_kill: Callable[[], None] | None = None
    stats: FarmStats = field(default_factory=FarmStats)
    damage: DamageWatch = field(init=False)

    def __post_init__(self) -> None:
        self.damage = DamageWatch(stall_seconds=self.config.stall_seconds)

    # ------------------------------------------------------------- yardımcılar

    def _sleep_ms(self, milliseconds: int) -> None:
        if milliseconds > 0:
            self.clock.sleep(milliseconds / 1000.0)

    def _turn(self) -> None:
        """Karakteri biraz çevirir (yeni mob aramak için)."""
        if self.config.search_turn_key and self.config.search_turn_ms > 0:
            self.transport.key_down(self.config.search_turn_key)
            self._sleep_ms(self.config.search_turn_ms)
            self.transport.key_up(self.config.search_turn_key)

    def _read_target(self):
        """Hedef barını okur; okuyucu yoksa ``None``."""
        if self.target is None:
            return None
        return self.target.read(self.clock.monotonic())

    def _attack_once(self) -> None:
        if self.config.attack_key:
            self.transport.tap(self.config.attack_key, 45)
        elif self.config.attack_button:
            self.transport.click(self.config.attack_button, 60)

    # ---------------------------------------------------------------- hedefleme

    def acquire_target(self, should_continue: Callable[[], bool] = ALWAYS) -> bool:
        """Hedef seçer.

        Bar okuyucusu varsa hedefin gerçekten seçildiği doğrulanır; seçilmezse
        karakter çevrilip yeniden denenir. Okuyucu yoksa Tab'a basıp geçer.
        """
        attempts = self.config.search_attempts if self.target is not None else 1

        for attempt in range(attempts):
            if not should_continue():
                return False
            if attempt > 0:
                self._turn()

            self.transport.tap(self.config.target_key, 45)
            self._sleep_ms(self.config.retarget_delay_ms)

            if self.target is None:
                return True

            # Hedef barının belirmesini bekle.
            deadline = self.clock.monotonic() + self.config.acquire_timeout_ms / 1000.0
            while self.clock.monotonic() < deadline:
                if not should_continue():
                    return False
                state = self._read_target()
                if state is not None and state.alive:
                    self.damage.reset(self.clock.monotonic())
                    return True
                self._sleep_ms(self.config.poll_ms)

        self.stats.misses += 1
        log.debug("hedef bulunamadı (%d deneme)", attempts)
        return False

    # ------------------------------------------------------------------ saldırı

    def engage(self, should_continue: Callable[[], bool] = ALWAYS) -> bool:
        """Hedefe saldırır.

        ``True`` = mob öldü. ``False`` = süre doldu, hasar girmedi ya da döngü
        durduruldu.
        """
        deadline = self.clock.monotonic() + self.config.engage_seconds
        killed = False

        while self.clock.monotonic() < deadline and should_continue():
            if self.combo is not None and self.runner.is_ready(self.combo):
                self.runner.run(self.combo, should_continue=should_continue)
                self.stats.combos += 1
            else:
                self._attack_once()
                self.clock.sleep(self.config.poll_ms / 1000.0)

            state = self._read_target()
            if state is None:
                continue  # kör kip: sadece süreye bak

            now = self.clock.monotonic()
            if not state.alive:
                killed = True
                break
            self.damage.update(state, now)
            if self.damage.stalled(now):
                # Bar sabit kalmış: menzil dışı ya da vuruşlar boşa gidiyor.
                self.stats.abandoned += 1
                log.debug("hasar girmiyor, hedef bırakıldı")
                return False

        if self.target is None:
            # Kör kipte ölümü göremeyiz; süre dolduysa öldü varsayılır.
            return self.clock.monotonic() >= deadline
        return killed

    def loot(self) -> None:
        """Yağmalama tuşuna birkaç kez basar."""
        if not self.config.loot_key:
            return
        for _ in range(max(1, self.config.loot_repeat)):
            self.transport.tap(self.config.loot_key, 45)
            self._sleep_ms(120)

    # -------------------------------------------------------------------- döngü

    def cycle(self, should_continue: Callable[[], bool] = ALWAYS) -> bool:
        """Tek bir hedef turu. Döngü devam edebiliyorsa ``True`` döner."""
        if not should_continue():
            return False

        self.stats.cycles += 1
        if not self.acquire_target(should_continue):
            # Hedef yok: biraz çevirip bir sonraki turda tekrar dener.
            self._turn()
            return should_continue()

        killed = self.engage(should_continue)
        if not should_continue():
            return False

        if killed:
            self.loot()
            self.stats.kills += 1
            if self.on_kill is not None:
                self.on_kill()
        return True

    def run(
        self,
        should_continue: Callable[[], bool] = ALWAYS,
        max_cycles: int | None = None,
    ) -> FarmStats:
        """Döngüyü ``should_continue`` false olana ya da tur sayısı dolana kadar sürdürür."""
        self.stats = FarmStats(started_at=self.clock.monotonic())
        while should_continue():
            if max_cycles is not None and self.stats.cycles >= max_cycles:
                break
            if not self.cycle(should_continue):
                break
        self.stats.stopped_at = self.clock.monotonic()
        log.info(
            "farm durdu: %d tur, %d kill, %.0f kill/saat",
            self.stats.cycles,
            self.stats.kills,
            self.stats.kills_per_hour(self.clock.monotonic()),
        )
        return self.stats
