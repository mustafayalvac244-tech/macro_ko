"""Tek amaçlı yardımcı makrolar.

Hepsi :class:`~ko_macro.config.Combo` üretir; böylece jitter, burst ve iptal
mekanizması combo motorundan bedava gelir.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .clock import Clock
from .config import Combo, ComboStep, ConfigError, UtilityConfig
from .transport import Transport

log = logging.getLogger(__name__)


def _key_steps(keys: list[str], gap_ms: int, hold_ms: int = 45) -> list[ComboStep]:
    return [ComboStep(key=key, hold_ms=hold_ms, gap_ms=gap_ms) for key in keys]


def upgrade_combo(config: UtilityConfig, speed_ms: int | None = None) -> Combo:
    """Anvil'de tekrar eden basma dizisi (hız ayarlanabilir)."""
    if not config.upgrade_keys:
        raise ConfigError("utility.upgrade_keys tanımlı değil")
    gap = int(speed_ms if speed_ms is not None else config.upgrade_speed_ms)
    return Combo(
        name="upgrade",
        steps=_key_steps(config.upgrade_keys, gap),
        repeat=max(1, config.upgrade_rounds),
        description="Upgrade (anvil) dizisi",
    )


def repair_combo(config: UtilityConfig) -> Combo:
    """Magic hammer / tamir dizisi."""
    if not config.repair_keys:
        raise ConfigError("utility.repair_keys tanımlı değil")
    return Combo(
        name="repair",
        steps=_key_steps(config.repair_keys, config.repair_speed_ms),
        description="Magic hammer ile tamir",
    )


def descent_combo(config: UtilityConfig) -> Combo:
    """Descent (iniş) tuşu."""
    if not config.descent_key:
        raise ConfigError("utility.descent_key tanımlı değil")
    return Combo(
        name="descent",
        steps=[ComboStep(key=config.descent_key, hold_ms=45, gap_ms=200)],
        description="Descent kullan",
    )


def equipment_combo(config: UtilityConfig, set_name: str) -> Combo:
    """Ekipman seti değiştirme dizisi."""
    keys = config.equipment_sets.get(set_name)
    if not keys:
        available = ", ".join(sorted(config.equipment_sets)) or "yok"
        raise ConfigError(f"ekipman seti yok: {set_name!r} (tanımlı: {available})")
    return Combo(
        name=f"equip:{set_name}",
        steps=_key_steps(keys, config.equipment_speed_ms),
        description=f"{set_name} setine geç",
    )


@dataclass
class AntiAfk:
    """Belirli aralıklarla küçük bir hareket yaparak AFK sayılmayı önler."""

    config: UtilityConfig
    clock: Clock
    _last: float = float("-inf")

    def due(self, now: float) -> bool:
        return (now - self._last) >= self.config.anti_afk_interval_s

    def tick(self, transport: Transport, now: float) -> bool:
        """Zamanı geldiyse hareketi yapar; yaptıysa ``True`` döner."""
        if self.config.anti_afk_interval_s <= 0:
            return False
        if not self.due(now):
            return False
        self._last = now
        if self.config.anti_afk_key:
            transport.tap(self.config.anti_afk_key, 45)
        elif self.config.anti_afk_click:
            transport.click(self.config.anti_afk_click, 60)
        else:
            return False
        log.debug("anti-afk hareketi yapıldı")
        return True


def build_utility_combos(config: UtilityConfig) -> dict[str, Combo]:
    """Config'de tanımlı olan tüm yardımcı comboları toplar."""
    combos: dict[str, Combo] = {}
    for name, builder in (
        ("upgrade", upgrade_combo),
        ("repair", repair_combo),
        ("descent", descent_combo),
    ):
        try:
            combos[name] = builder(config)
        except ConfigError:
            continue  # Tanımlanmamış yardımcılar sessizce atlanır.
    for set_name in config.equipment_sets:
        combos[f"equip:{set_name}"] = equipment_combo(config, set_name)
    return combos
