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
import threading
from dataclasses import dataclass, field
from typing import Callable

from .clock import Clock
from .config import Combo, FarmConfig
from .sequence import ComboRunner
from .transport import Transport
from .nameplate import NameMatcher
from .vitals import DamageWatch, TargetMonitor

log = logging.getLogger(__name__)

#: Her zaman devam et.
ALWAYS: Callable[[], bool] = lambda: True


@dataclass
class KillWatcher:
    """Combo çalışırken hedefi izler, ölünce comboyu **anında** keser.

    Neden ayrı bir izleyici gerekiyor: combo adımları tek seferde Leonardo'nun
    kuyruğuna yüklenip mikrodenetleyicide çalışıyor. Kuyruk çalışırken PC
    adımların arasına giremez — mob ilk skill'de ölse bile kalan skill'ler
    cesedine giderdi. Bu izleyici barı ayrı bir thread'den okur ve ölümü
    görünce firmware'e iptal baytı yollar (``transport.abort``); kuyruk o anda
    durur, basılı tuşlar bırakılır.
    """

    target: TargetMonitor
    transport: Transport
    clock: Clock
    poll_s: float = 0.1

    triggered: bool = field(default=False, init=False)
    _stop: threading.Event = field(default_factory=threading.Event, init=False)
    _thread: threading.Thread | None = field(default=None, init=False)

    def poll_once(self) -> bool:
        """Bir kez bakar. Hedef öldüyse comboyu keser ve ``True`` döner."""
        if self.triggered:
            return True
        state = self.target.read(self.clock.monotonic())
        if state.alive:
            return False
        self.triggered = True
        self.transport.abort()
        log.debug("hedef düştü, combo kesildi")
        return True

    def _loop(self) -> None:
        while not self._stop.wait(self.poll_s):
            try:
                if self.poll_once():
                    return
            except Exception as exc:  # ekran okuma hatası combo'yu düşürmesin
                log.warning("hedef izlenemedi: %s", exc)
                return

    def __enter__(self) -> "KillWatcher":
        self.triggered = False
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop, name="ko-kill-watcher", daemon=True
        )
        self._thread.start()
        return self

    def __exit__(self, *exc_info: object) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self._thread = None


@dataclass
class FarmStats:
    """Döngü sayaçları."""

    cycles: int = 0
    kills: int = 0
    combos: int = 0
    misses: int = 0        # taze hedef bulunamayan turlar
    abandoned: int = 0     # hasar girmediği için bırakılan hedefler
    skipped: int = 0       # yarım canlı olduğu için atlanan hedefler
    wrong_mob: int = 0     # adı tutmadığı için atlanan hedefler
    cut_short: int = 0     # hedef ölünce yarıda kesilen combolar
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
    #: Mob adı filtresi; ``None`` ise her hedef kabul edilir.
    name_matcher: NameMatcher | None = None
    #: Ad filtresi için taze ekran görüntüsü üreten çağrı.
    screen_factory: Callable[[], object] | None = None
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

    def _name_accepted(self) -> bool:
        """Hedefin adı kabul listesinde mi? Filtre yoksa her hedef geçer."""
        if self.name_matcher is None or self.screen_factory is None:
            return True
        try:
            accepted = self.name_matcher.accepts(self.screen_factory())
        except Exception as exc:  # ekran okuma hatası döngüyü durdurmasın
            log.warning("hedef adı okunamadı: %s", exc)
            return True
        if not accepted:
            log.debug(
                "yanlış mob atlandı (benzerlik %%%.0f)", self.name_matcher.last_score * 100
            )
        return accepted

    def target_is_alive(self) -> bool:
        """Hedef hâlâ ayakta mı? Bar okuyucusu yoksa ``True`` varsayılır."""
        if self.target is None:
            return True
        return self.target.read(self.clock.monotonic()).alive

    def _attack_once(self) -> None:
        if self.config.attack_key:
            self.transport.tap(self.config.attack_key, 45)
        elif self.config.attack_button:
            self.transport.click(self.config.attack_button, 60)

    # ---------------------------------------------------------------- hedefleme

    def acquire_target(self, should_continue: Callable[[], bool] = ALWAYS) -> bool:
        """Taze bir hedef seçer.

        Tab en yakındakini seçer; bu da az önce öldürdüğün **ceset** ya da
        başkasının dövdüğü **yarım canlı** mob olabilir. İkisini de canından
        ayırt ediyoruz: taze mobun canı doludur.

        * bar hiç yok / boş  → ceset ya da hedef yok, Tab'a tekrar bas
        * bar ``min_target_hp_pct``'in altında → başkasının mobu, atla
        * bar dolu → kabul

        Birkaç denemede taze hedef çıkmazsa karakter çevrilip tekrar denenir.
        """
        attempts = self.config.search_attempts if self.target is not None else 1
        threshold = self.config.min_target_hp_pct / 100.0

        for attempt in range(attempts):
            if not should_continue():
                return False
            # İlk birkaç denemede sadece Tab'la sıradakine geç; olmuyorsa çevir.
            if attempt > 0 and attempt % self.config.turn_after_attempts == 0:
                self._turn()

            self.transport.tap(self.config.target_key, 45)
            self._sleep_ms(self.config.retarget_delay_ms)

            if self.target is None:
                return True

            # Hedef barının belirmesini bekle.
            deadline = self.clock.monotonic() + self.config.acquire_timeout_ms / 1000.0
            state = None
            while self.clock.monotonic() < deadline:
                if not should_continue():
                    return False
                state = self._read_target()
                if state is not None and state.alive:
                    break
                self._sleep_ms(self.config.poll_ms)

            if state is None or not state.alive:
                continue  # ceset ya da hedef yok

            if state.hp_pct < threshold:
                # Yarım canlı: başkası dövüyor ya da az önce vurduğumuz mob.
                self.stats.skipped += 1
                log.debug("yarım canlı hedef atlandı (%%%.0f)", state.hp_pct * 100)
                continue

            if not self._name_accepted():
                self.stats.wrong_mob += 1
                continue

            self.damage.reset(self.clock.monotonic())
            return True

        self.stats.misses += 1
        log.debug("taze hedef bulunamadı (%d deneme)", attempts)
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
                killed = self._run_combo_watching_target(should_continue) or killed
                self.stats.combos += 1
                if killed:
                    break
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

    def _run_combo_watching_target(self, should_continue: Callable[[], bool]) -> bool:
        """Comboyu çalıştırır; hedef ölürse yarıda keser. Öldüyse ``True``.

        İki katmanlı kontrol var:

        * **Senkron** — adımlar/parçalar arasında ``poll_once`` çağrılır. Tek
          tek gönderilen combolarda her skill'den önce bakılır.
        * **Arka plan** — burst kipinde combo Leonardo'da çalışırken PC
          adımların arasına giremez; izleyici thread barı okuyup firmware'e
          iptal baytı yollar.
        """
        assert self.combo is not None
        if self.target is None:
            self.runner.run(self.combo, should_continue=should_continue)
            return False

        watcher = KillWatcher(
            target=self.target,
            transport=self.transport,
            clock=self.clock,
            poll_s=max(0.02, self.config.poll_ms / 1000.0),
        )

        def keep_going() -> bool:
            if not should_continue():
                return False
            return not watcher.poll_once()

        with watcher:
            self.runner.run(self.combo, should_continue=keep_going)
        if watcher.triggered:
            self.stats.cut_short += 1
        return watcher.triggered

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
            # Ceset bir süre daha seçilebilir kalıyor; hemen Tab'a basmak onu
            # yeniden seçtirir. Kısa bir bekleme bunu engelliyor.
            self._sleep_ms(self.config.post_kill_delay_ms)
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
