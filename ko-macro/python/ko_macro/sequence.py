"""Combo çalıştırma motoru.

Bir :class:`~ko_macro.config.Combo` alır, adımlarını jitter'layıp taşıma
katmanına verir. Leonardo bağlıysa adımlar tek seferde firmware kuyruğuna
yüklenir (``burst``) — böylece adımlar arası zamanlamayı PC'nin seri gecikmesi
değil mikrodenetleyicinin saati belirler.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from typing import Callable

from .clock import Clock
from .config import Combo, TimingConfig
from .timing import apply_jitter
from .transport import Transport

log = logging.getLogger(__name__)

#: Firmware kuyruğunun kapasitesi (ko_hid_bridge.ino: MAX_STEPS).
MAX_BURST_STEPS = 32


@dataclass
class PlannedStep:
    """Jitter uygulanmış, tuşu çözülmüş adım."""

    key: str | None
    button: str | None
    hold_ms: int
    gap_ms: int
    label: str


@dataclass
class ComboResult:
    """Bir combo çalıştırmasının sonucu."""

    combo: str
    rounds: int = 0
    steps: int = 0
    aborted: bool = False
    duration_ms: int = 0


@dataclass
class ComboRunner:
    """Comboları çalıştırır ve cooldown durumlarını tutar."""

    transport: Transport
    timing: TimingConfig
    clock: Clock
    skillbar: dict[str, str] = field(default_factory=dict)
    rng: random.Random = field(default_factory=random.Random)
    #: Duruş tuşu (okçuda Z); ``restore_stance`` olan combolarda sona eklenir.
    stance_key: str | None = None
    stance_delay_ms: int = 120

    #: combo adı -> son çalıştırma anı (monotonic)
    _last_run: dict[str, float] = field(default_factory=dict, init=False)

    # -- cooldown ----------------------------------------------------------

    def remaining_cooldown(self, combo: Combo) -> float:
        """Combo'nun hazır olmasına kaç saniye kaldığı."""
        if combo.cooldown_ms <= 0:
            return 0.0
        last = self._last_run.get(combo.name)
        if last is None:
            return 0.0
        elapsed = self.clock.monotonic() - last
        return max(0.0, combo.cooldown_ms / 1000.0 - elapsed)

    def is_ready(self, combo: Combo) -> bool:
        return self.remaining_cooldown(combo) <= 0.0

    # -- planlama ----------------------------------------------------------

    def plan(self, combo: Combo) -> list[PlannedStep]:
        """Combo adımlarını açar, tuşları çözer ve jitter uygular."""
        planned: list[PlannedStep] = []
        for step in combo.steps:
            key = step.resolve_key(self.skillbar)
            for _ in range(step.repeat):
                planned.append(
                    PlannedStep(
                        key=key,
                        button=step.button,
                        hold_ms=max(1, apply_jitter(step.hold_ms, self.timing.hold_jitter_pct, self.rng)),
                        gap_ms=apply_jitter(step.gap_ms, self.timing.jitter_pct, self.rng),
                        label=step.display,
                    )
                )

        # Bazı skill dizileri karakteri duruştan çıkarıyor (okçuda Z). İstenirse
        # combo bittikten sonra duruşa geri dönülür.
        if combo.restore_stance and self.stance_key:
            planned.append(
                PlannedStep(
                    key=self.stance_key,
                    button=None,
                    hold_ms=45,
                    gap_ms=apply_jitter(self.stance_delay_ms, self.timing.jitter_pct, self.rng),
                    label="duruş",
                )
            )
        return planned

    # -- çalıştırma --------------------------------------------------------

    def run(
        self,
        combo: Combo,
        repeat: int | None = None,
        should_continue: Callable[[], bool] | None = None,
    ) -> ComboResult:
        """Comboyu çalıştırır.

        ``should_continue`` her tur (burst modunda her parça) öncesi sorulur;
        ``False`` dönerse combo yarıda kesilir.
        """
        rounds = max(1, repeat if repeat is not None else combo.repeat)
        result = ComboResult(combo=combo.name)
        started = self.clock.monotonic()
        self._last_run[combo.name] = started

        for round_index in range(rounds):
            if should_continue is not None and not should_continue():
                result.aborted = True
                break
            if round_index > 0 and self.timing.combo_gap_ms > 0:
                self.clock.sleep(
                    apply_jitter(self.timing.combo_gap_ms, self.timing.jitter_pct, self.rng) / 1000.0
                )

            planned = self.plan(combo)
            use_burst = combo.burst and self.transport.supports_burst
            executed = (
                self._run_burst(planned, should_continue)
                if use_burst
                else self._run_sequential(planned, should_continue)
            )
            result.steps += abs(executed)
            result.rounds += 1
            if executed < 0:
                result.aborted = True
                break

        result.duration_ms = int((self.clock.monotonic() - started) * 1000)
        # Cooldown combo bittiğinde başlasın; uzun combolarda doğru davranış bu.
        self._last_run[combo.name] = self.clock.monotonic()
        log.debug("combo %s: %s", combo.name, result)
        return result

    def _run_sequential(
        self, planned: list[PlannedStep], should_continue: Callable[[], bool] | None
    ) -> int:
        """Adımları tek tek gönderir. Kesilirse negatif sayı döndürür."""
        executed = 0
        for step in planned:
            if should_continue is not None and not should_continue():
                return -executed
            if step.button is not None:
                self.transport.click(step.button, step.hold_ms)
            else:
                assert step.key is not None
                self.transport.tap(step.key, step.hold_ms)
            executed += 1
            if step.gap_ms > 0:
                self.clock.sleep(step.gap_ms / 1000.0)
        return executed

    def _run_burst(
        self, planned: list[PlannedStep], should_continue: Callable[[], bool] | None
    ) -> int:
        """Adımları firmware kuyruğuna yükleyip çalıştırır.

        Kuyruk kapasitesini aşan combolar parçalara bölünür; sadece parça
        sınırlarında PC gecikmesi devreye girer.
        """
        executed = 0
        for start in range(0, len(planned), MAX_BURST_STEPS):
            if should_continue is not None and not should_continue():
                return -executed
            chunk = planned[start : start + MAX_BURST_STEPS]
            self.transport.queue_clear()
            for step in chunk:
                if step.button is not None:
                    self.transport.queue_click(step.button, step.hold_ms, step.gap_ms)
                else:
                    assert step.key is not None
                    self.transport.queue_key(step.key, step.hold_ms, step.gap_ms)
            count = self.transport.run_queue(1)
            executed += abs(count)
            if count < 0:
                return -executed
        return executed


def describe_combo(combo: Combo, skillbar: dict[str, str]) -> str:
    """Comboyu ``tab → 3 → 5`` gibi okunur bir dizi olarak yazar."""
    parts: list[str] = []
    for step in combo.steps:
        key = step.resolve_key(skillbar)
        token = f"fare:{step.button}" if key is None else key
        annotation = step.label or step.skill
        if annotation:
            token = f"{token}({annotation})"
        if step.repeat > 1:
            token = f"{token}x{step.repeat}"
        parts.append(token)
    return " → ".join(parts)


def total_steps(combo: Combo) -> int:
    """Combo'nun açılmış hâlindeki adım sayısı."""
    return sum(step.repeat for step in combo.steps)
