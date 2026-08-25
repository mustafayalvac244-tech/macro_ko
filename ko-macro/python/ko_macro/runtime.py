"""Tüm parçaları çalıştıran motor.

Tek bir iş parçacığı tuşlara basar. Kısayollar ayrı bir hook thread'inden
gelir ama sadece kuyruğa istek bırakır; böylece aynı anda iki yerden tuş
gönderilmez.
"""

from __future__ import annotations

import logging
import queue
import random
import threading
from dataclasses import dataclass, field
from typing import Any, Callable

from .autocast import AutoCaster, AutoCastRule
from .clock import Clock, RealClock
from .config import AppConfig, Combo
from .farm import FarmLoop, FarmStats
from .hotkeys import HotkeyManager
from .sequence import ComboRunner
from .spawn import SpawnBook
from .transport import Transport, TransportError, create_transport
from .utility import AntiAfk, build_utility_combos
from .vitals import MSSSampler, ScreenSampler, TargetMonitor, VitalsMonitor, create_monitor

log = logging.getLogger(__name__)


@dataclass
class Request:
    """Kuyruğa bırakılan iş."""

    kind: str  # combo | utility | toggle_farm | mark_kill | stop
    name: str = ""


class MacroEngine:
    """Combo, farm, can takibi ve doğuş kaydını yöneten motor."""

    def __init__(
        self,
        config: AppConfig,
        transport: Transport | None = None,
        clock: Clock | None = None,
        spawn_book: SpawnBook | None = None,
        sampler: ScreenSampler | None = None,
        rng: random.Random | None = None,
    ) -> None:
        self.config = config
        self._stop = threading.Event()
        self.transport = transport or create_transport(config.transport.kind, config.transport.port)
        self.clock = clock or RealClock(stop_event=self._stop)
        self.spawn_book = spawn_book
        self.rng = rng or random.Random()

        self.runner = ComboRunner(
            transport=self.transport,
            timing=config.timing,
            clock=self.clock,
            skillbar=config.skillbar,
            rng=self.rng,
            stance_key=config.stance_key,
            stance_delay_ms=config.stance_delay_ms,
        )
        self.autocaster = AutoCaster(rules=list(config.autocast), rng=self.rng)
        self.utility_combos = build_utility_combos(config.utility)
        self.anti_afk = AntiAfk(config=config.utility, clock=self.clock)

        # Ekran okuyucusu can barı ve hedef barı arasında paylaşılır.
        needs_screen = config.vitals.enabled or config.farm.target_bar is not None
        self.sampler: ScreenSampler | None = sampler or (MSSSampler() if needs_screen else None)
        self.vitals: VitalsMonitor | None = (
            create_monitor(config.vitals, self.sampler) if config.vitals.enabled else None
        )
        target: TargetMonitor | None = None
        if config.farm.target_bar is not None and self.sampler is not None:
            target = TargetMonitor(region=config.farm.target_bar, sampler=self.sampler)

        farm_combo = config.find_combo(config.farm.combo) if config.farm.combo else None
        self.farm = FarmLoop(
            config=config.farm,
            runner=self.runner,
            transport=self.transport,
            clock=self.clock,
            combo=farm_combo,
            target=target,
            on_kill=self._record_farm_kill,
        )

        self.hotkeys = HotkeyManager()
        self._queue: queue.Queue[Request] = queue.Queue()
        self._worker: threading.Thread | None = None
        self._busy = threading.Event()
        self.farm_enabled = config.farm.enabled
        self.last_combo: str = "-"
        self.combo_count = 0
        self.started_at = 0.0
        self.error: str | None = None

    # ------------------------------------------------------------- yaşam döngüsü

    def start(self, with_hotkeys: bool = True) -> None:
        """Cihaza bağlanır, kısayolları kurar ve çalışma döngüsünü başlatır."""
        self.transport.connect()
        self.transport.arm()
        self._stop.clear()
        self.started_at = self.clock.monotonic()
        # Kuralların ilk tetiklemesini dağıt: hepsi aynı anda patlamasın.
        self.autocaster.prime(self.started_at)

        if with_hotkeys:
            self._bind_hotkeys()
            self.hotkeys.start()

        self._worker = threading.Thread(target=self._run, name="ko-macro", daemon=True)
        self._worker.start()
        log.info("motor çalışıyor (%s)", self.transport.name)

    def stop(self) -> None:
        """Her şeyi durdurur ve cihazı güvenli hâle getirir."""
        self._stop.set()
        self._queue.put(Request("stop"))
        worker = self._worker
        if worker is not None and worker.is_alive():
            worker.join(timeout=5.0)
        self._worker = None
        self.hotkeys.stop()
        try:
            self.transport.disarm()
        except TransportError as exc:  # pragma: no cover - donanıma bağlı
            log.warning("cihaz kapatılamadı: %s", exc)
        finally:
            self.transport.close()
        log.info("motor durdu")

    def panic(self) -> None:
        """Acil durdurma: çalışan comboyu keser, tuşları bırakır, döngüyü durdurur."""
        log.warning("PANİK — her şey durduruluyor")
        self._stop.set()
        self.farm_enabled = False
        try:
            self.transport.abort()
        except TransportError as exc:  # pragma: no cover - donanıma bağlı
            log.warning("iptal gönderilemedi: %s", exc)
        self._queue.put(Request("stop"))

    @property
    def running(self) -> bool:
        return not self._stop.is_set()

    @property
    def busy(self) -> bool:
        """Şu an bir combo çalışıyor mu?"""
        return self._busy.is_set()

    # ------------------------------------------------------------------ istekler

    def request_combo(self, name: str) -> None:
        """Combo çalıştırma isteği bırakır (kısayol thread'inden güvenli)."""
        if self._busy.is_set():
            # Combo çalışırken gelen tetikleme yok sayılır: Leonardo'nun bastığı
            # tuşları hook da gördüğü için kendi kendini tetiklemesin.
            log.debug("combo çalışıyor, istek atlandı: %s", name)
            return
        self._queue.put(Request("combo", name))

    def request_utility(self, name: str) -> None:
        self._queue.put(Request("utility", name))

    def toggle_farm(self) -> None:
        self._queue.put(Request("toggle_farm"))

    def mark_kill(self) -> None:
        self._queue.put(Request("mark_kill"))

    # -------------------------------------------------------------------- döngü

    def _run(self) -> None:
        while not self._stop.is_set():
            self._pump_background()
            try:
                request = self._queue.get(timeout=0.05)
            except queue.Empty:
                if self.farm_enabled:
                    self.farm.cycle(self._should_continue)
                continue

            if request.kind == "stop":
                break
            try:
                self._handle(request)
            except Exception as exc:  # döngü tek bir hatayla ölmesin
                self.error = f"{request.kind} {request.name}: {exc}"
                log.exception("istek işlenemedi: %s", request)

    def _handle(self, request: Request) -> None:
        if request.kind == "combo":
            combo = self.config.find_combo(request.name)
            if combo is None:
                self.error = f"combo bulunamadı: {request.name}"
                return
            self._execute(combo)
        elif request.kind == "utility":
            combo = self.utility_combos.get(request.name)
            if combo is None:
                self.error = f"yardımcı makro yok: {request.name}"
                return
            self._execute(combo)
        elif request.kind == "toggle_farm":
            self.farm_enabled = not self.farm_enabled
            log.info("farm döngüsü %s", "açık" if self.farm_enabled else "kapalı")
        elif request.kind == "mark_kill":
            self._record_farm_kill()

    def _execute(self, combo: Combo) -> None:
        """Bir comboyu çalıştırır ve sayaçları günceller."""
        if self.vitals is not None and not self.vitals.combo_allowed():
            log.info("can düşük, combo ertelendi: %s", combo.name)
            return
        if not self.runner.is_ready(combo):
            log.debug("cooldown: %s (%.1fs)", combo.name, self.runner.remaining_cooldown(combo))
            return

        self._busy.set()
        try:
            repeat = None
            if combo.loop:
                # Döngüsel combolar durdurulana kadar tekrar eder; yüksek bir
                # üst sınır sonsuz döngüyü engeller.
                repeat = 10_000
            result = self.runner.run(combo, repeat=repeat, should_continue=self._should_continue)
        finally:
            self._busy.clear()

        self.last_combo = combo.name
        self.combo_count += 1
        if result.aborted:
            log.debug("combo kesildi: %s", combo.name)

    def _should_continue(self) -> bool:
        """Combo turları arasında çağrılır: durdurma, can ve anti-AFK kontrolü."""
        if self._stop.is_set():
            return False
        self._pump_background()
        if self.vitals is not None and not self.vitals.combo_allowed():
            return False
        return True

    def _pump_background(self) -> None:
        """Can/mana okuması, otomatik yetenekler ve anti-AFK.

        Combo çalışırken sadece can okuması yapılır; başka tuş gönderilmez ki
        combo dizisi bozulmasın.
        """
        now = self.clock.monotonic()
        if self.vitals is not None:
            try:
                self.vitals.tick(self.transport, now)
            except Exception as exc:  # ekran okuma hatası döngüyü durdurmasın
                self.error = f"can okuma hatası: {exc}"
                log.warning("can okunamadı: %s", exc)
        if not self._busy.is_set():
            self._pump_autocast(now)
            self.anti_afk.tick(self.transport, now)

    def _pump_autocast(self, now: float) -> None:
        """Zamanı/koşulu gelen otomatik yetenekleri çalıştırır."""
        if not self.autocaster.rules:
            return
        snapshot = self.vitals.snapshot if self.vitals else None
        due = self.autocaster.due(
            now,
            hp_pct=snapshot.hp_pct if snapshot else None,
            mp_pct=snapshot.mp_pct if snapshot else None,
            farming=self.farm_enabled,
        )
        for rule in due:
            if self._stop.is_set():
                return
            try:
                self._fire_autocast(rule)
            except Exception as exc:
                self.error = f"autocast {rule.name}: {exc}"
                log.warning("autocast çalıştırılamadı (%s): %s", rule.name, exc)
            finally:
                self.autocaster.mark(rule, self.clock.monotonic())

    def _fire_autocast(self, rule: AutoCastRule) -> None:
        if rule.key:
            self.transport.tap(rule.key, 45)
            log.debug("autocast tuş: %s (%s)", rule.key, rule.name)
            return
        assert rule.combo is not None
        combo = self.config.find_combo(rule.combo)
        if combo is None:
            self.error = f"autocast kuralı bilinmeyen comboyu gösteriyor: {rule.combo}"
            return
        self._execute(combo)

    # ------------------------------------------------------------------- doğuş

    def _record_farm_kill(self) -> None:
        """Farm turunu doğuş defterine yazar."""
        point_id = self.config.farm.spawn_point
        if not point_id or self.spawn_book is None:
            return
        try:
            self.spawn_book.record_kill(point_id)
            log.info("doğuş kaydı: %s", point_id)
        except Exception as exc:
            self.error = f"doğuş kaydedilemedi: {exc}"
            log.warning("doğuş kaydedilemedi: %s", exc)

    # ---------------------------------------------------------------- kısayollar

    def _bind_hotkeys(self) -> None:
        hotkey_config = self.config.hotkeys
        self.hotkeys.register(hotkey_config.panic, self.panic)
        self.hotkeys.register(hotkey_config.start_stop, self.toggle_farm)
        if hotkey_config.toggle_farm and hotkey_config.toggle_farm != hotkey_config.start_stop:
            self.hotkeys.register(hotkey_config.toggle_farm, self.toggle_farm)
        if hotkey_config.mark_kill:
            self.hotkeys.register(hotkey_config.mark_kill, self.mark_kill)

        for combo in self.config.combos:
            if not combo.hotkey:
                continue
            if combo.hotkey in self.hotkeys.bindings:
                log.warning("kısayol çakışması, atlandı: %s (%s)", combo.hotkey, combo.name)
                continue
            self.hotkeys.register(combo.hotkey, self._combo_trigger(combo.name))

    def _combo_trigger(self, name: str) -> Callable[[], None]:
        def trigger() -> None:
            self.request_combo(name)

        return trigger

    # ------------------------------------------------------------------- durum

    def status(self) -> dict[str, Any]:
        """Panoda gösterilecek anlık özet."""
        now = self.clock.monotonic()
        snapshot = self.vitals.snapshot if self.vitals else None
        stats: FarmStats = self.farm.stats
        return {
            "transport": self.transport.name,
            "profile": self.config.profile_name or "-",
            "running": self.running,
            "busy": self.busy,
            "farm": self.farm_enabled,
            "hotkeys": self.hotkeys.active,
            "last_combo": self.last_combo,
            "combo_count": self.combo_count,
            "uptime_s": now - self.started_at if self.started_at else 0.0,
            "hp_pct": None if snapshot is None else snapshot.hp_pct,
            "mp_pct": None if snapshot is None else snapshot.mp_pct,
            "farm_cycles": stats.cycles,
            "farm_kills": stats.kills,
            "farm_misses": stats.misses,
            "farm_abandoned": stats.abandoned,
            "target_hp_pct": (
                self.farm.target.state.hp_pct if self.farm.target is not None else None
            ),
            "kills_per_hour": stats.kills_per_hour(now) if stats.started_at else 0.0,
            "autocast": [
                (rule.name, self.autocaster.remaining(rule, now))
                for rule in self.autocaster.rules
                if rule.enabled
            ],
            "error": self.error,
        }
