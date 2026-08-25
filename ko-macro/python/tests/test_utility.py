"""Yardımcı makrolar ve tetiklenme yolları.

Bu testlerin varlık sebebi: upgrade/tamir/descent/ekipman makroları kodda
tanımlıydı ama hiçbir yerden tetiklenemiyordu (kısayolu yoktu, autocast
bulamıyordu). Aşağıdakiler o yolların açık kaldığını garanti eder.
"""

from __future__ import annotations

import pytest

from ko_macro.clock import FakeClock
from ko_macro.config import AppConfig, ConfigError, UtilityConfig
from ko_macro.transport import DryRunTransport
from ko_macro.utility import (
    AntiAfk,
    build_utility_combos,
    equipment_combo,
    repair_combo,
    upgrade_combo,
)

BASE = {
    "skillbar": {"spike": "1"},
    "combos": [{"name": "test", "steps": [{"skill": "spike"}]}],
}


def utility(**kwargs) -> UtilityConfig:
    defaults = dict(
        upgrade_keys=["enter", "enter"],
        repair_keys=["r", "enter"],
        descent_key="f8",
        equipment_sets={"pvp": ["f1", "f2"]},
    )
    defaults.update(kwargs)
    return UtilityConfig(**defaults)


# ------------------------------------------------------------------- üretim


def test_build_collects_every_defined_macro():
    combos = build_utility_combos(utility())
    assert set(combos) == {"upgrade", "repair", "descent", "equip:pvp"}


def test_build_skips_undefined_macros():
    combos = build_utility_combos(UtilityConfig())
    assert combos == {}


def test_upgrade_speed_can_be_overridden():
    combo = upgrade_combo(utility(), speed_ms=50)
    assert all(step.gap_ms == 50 for step in combo.steps)


def test_upgrade_rounds_are_kept():
    assert upgrade_combo(utility(upgrade_rounds=5)).repeat == 5


def test_repair_uses_configured_keys():
    combo = repair_combo(utility())
    assert [step.key for step in combo.steps] == ["r", "enter"]


def test_missing_macro_raises():
    with pytest.raises(ConfigError, match="upgrade_keys"):
        upgrade_combo(UtilityConfig())
    with pytest.raises(ConfigError, match="ekipman seti yok"):
        equipment_combo(utility(), "yok")


# --------------------------------------------------------- tetiklenme yolları


def test_available_names_reflects_config():
    assert utility().available_names() == {"upgrade", "repair", "descent", "equip:pvp"}
    assert UtilityConfig().available_names() == set()


def test_autocast_can_target_a_utility_macro():
    raw = dict(
        BASE,
        utility={"repair_keys": ["r", "enter"]},
        autocast=[{"name": "oto-tamir", "combo": "repair", "every_s": 900}],
    )
    config = AppConfig.from_dict(raw)
    assert config.autocast[0].combo == "repair"


def test_autocast_rejects_undefined_utility_macro():
    raw = dict(BASE, autocast=[{"name": "oto-tamir", "combo": "repair", "every_s": 900}])
    with pytest.raises(ConfigError, match="tanımsız bir comboyu"):
        AppConfig.from_dict(raw)


def test_utility_hotkey_must_reference_defined_macro():
    raw = dict(BASE, utility={"hotkeys": {"repair": "f4"}})
    with pytest.raises(ConfigError, match="utility.hotkeys tanımsız"):
        AppConfig.from_dict(raw)


def test_utility_hotkey_cannot_clash_with_combo_hotkey():
    raw = {
        "skillbar": {"spike": "1"},
        "combos": [{"name": "t", "hotkey": "f4", "steps": [{"skill": "spike"}]}],
        "utility": {"repair_keys": ["r"], "hotkeys": {"repair": "f4"}},
    }
    with pytest.raises(ConfigError, match="çakışıyor"):
        AppConfig.from_dict(raw)


def test_valid_utility_hotkey_is_normalized():
    raw = dict(BASE, utility={"repair_keys": ["r"], "hotkeys": {"repair": "F4"}})
    assert AppConfig.from_dict(raw).utility.hotkeys["repair"] == "f4"


# ------------------------------------------------------------------ anti-AFK


def test_anti_afk_fires_on_interval():
    clock = FakeClock()
    transport = DryRunTransport()
    guard = AntiAfk(config=utility(anti_afk_interval_s=60.0, anti_afk_key="1"), clock=clock)

    assert guard.tick(transport, now=0.0) is True     # ilk tur hemen
    assert guard.tick(transport, now=10.0) is False   # süre dolmadı
    assert guard.tick(transport, now=70.0) is True


def test_anti_afk_disabled_at_zero():
    guard = AntiAfk(config=utility(anti_afk_interval_s=0.0), clock=FakeClock())
    assert guard.tick(DryRunTransport(), now=1000.0) is False


def test_anti_afk_falls_back_to_click():
    transport = DryRunTransport()
    guard = AntiAfk(
        config=utility(anti_afk_interval_s=1.0, anti_afk_key=None, anti_afk_click="left"),
        clock=FakeClock(),
    )
    guard.tick(transport, now=0.0)
    assert transport.actions[0].kind == "click"


def test_anti_afk_without_action_does_nothing():
    guard = AntiAfk(
        config=utility(anti_afk_interval_s=1.0, anti_afk_key=None, anti_afk_click=None),
        clock=FakeClock(),
    )
    assert guard.tick(DryRunTransport(), now=0.0) is False


def test_utility_hotkey_cannot_clash_with_control_key():
    raw = dict(BASE, utility={"repair_keys": ["r"], "hotkeys": {"repair": "f12"}})
    with pytest.raises(ConfigError, match="kontrol tuşuyla çakışıyor"):
        AppConfig.from_dict(raw)
