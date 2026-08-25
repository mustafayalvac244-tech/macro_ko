"""Config yükleme ve doğrulama testleri."""

from __future__ import annotations

import pytest

from ko_macro.config import (
    AppConfig,
    Combo,
    ComboStep,
    ConfigError,
    available_profiles,
    load_config,
)
from ko_macro.keys import UnknownKeyError, normalize_key
from ko_macro.sequence import describe_combo

MINIMAL = {
    "skillbar": {"spike": "1"},
    "combos": [{"name": "test", "steps": [{"skill": "spike"}]}],
}


def write(tmp_path, text: str):
    path = tmp_path / "config.yaml"
    path.write_text(text, encoding="utf-8")
    return path


# ------------------------------------------------------------------ tuş adları


def test_normalize_key_accepts_aliases():
    assert normalize_key(" F1 ") == "f1"
    assert normalize_key("ESCAPE") == "esc"
    assert normalize_key("ctrl") == "lctrl"


def test_normalize_key_rejects_garbage():
    with pytest.raises(UnknownKeyError):
        normalize_key("kontrol")


# ---------------------------------------------------------------------- adımlar


def test_step_requires_exactly_one_target():
    with pytest.raises(ConfigError, match="tam olarak biri"):
        ComboStep.from_dict({"key": "1", "skill": "spike"})
    with pytest.raises(ConfigError, match="tam olarak biri"):
        ComboStep.from_dict({})


def test_step_validates_numbers():
    with pytest.raises(ConfigError, match="repeat"):
        ComboStep.from_dict({"key": "1", "repeat": 0})
    with pytest.raises(ConfigError, match="gap_ms"):
        ComboStep.from_dict({"key": "1", "gap_ms": -5})


def test_combo_requires_steps():
    with pytest.raises(ConfigError, match="hiç adım yok"):
        Combo.from_dict({"name": "bos", "steps": []})


# ----------------------------------------------------------------- doğrulama


def test_unknown_skill_is_caught_at_load():
    raw = {
        "skillbar": {"spike": "1"},
        "combos": [{"name": "x", "steps": [{"skill": "yok"}]}],
    }
    with pytest.raises(ConfigError, match="tanımsız yetenek"):
        AppConfig.from_dict(raw)


def test_duplicate_combo_names_rejected():
    raw = {
        "skillbar": {"spike": "1"},
        "combos": [
            {"name": "aynı", "steps": [{"skill": "spike"}]},
            {"name": "aynı", "steps": [{"skill": "spike"}]},
        ],
    }
    with pytest.raises(ConfigError, match="aynı isimde"):
        AppConfig.from_dict(raw)


def test_duplicate_hotkeys_rejected():
    raw = {
        "skillbar": {"spike": "1"},
        "combos": [
            {"name": "a", "hotkey": "f1", "steps": [{"skill": "spike"}]},
            {"name": "b", "hotkey": "f1", "steps": [{"skill": "spike"}]},
        ],
    }
    with pytest.raises(ConfigError, match="aynı hotkey"):
        AppConfig.from_dict(raw)


def test_farm_combo_must_exist():
    raw = dict(MINIMAL, farm={"combo": "olmayan"})
    with pytest.raises(ConfigError, match="farm.combo"):
        AppConfig.from_dict(raw)


def test_jitter_bounds_enforced():
    with pytest.raises(ConfigError, match="jitter_pct"):
        AppConfig.from_dict(dict(MINIMAL, timing={"jitter_pct": 150}))


def test_bar_region_requires_ordered_bounds():
    raw = dict(MINIMAL, vitals={"enabled": True, "hp": {"x0": 200, "x1": 100, "y": 10}})
    with pytest.raises(ConfigError, match="x1 > x0"):
        AppConfig.from_dict(raw)


def test_find_combo_is_case_insensitive():
    config = AppConfig.from_dict(MINIMAL)
    assert config.find_combo("TEST") is not None
    assert config.find_combo("yok") is None


# ------------------------------------------------------------------- profiller


def test_shipped_profiles_load():
    assert set(available_profiles()) >= {"archer", "priest"}


@pytest.mark.parametrize("profile", ["archer", "priest"])
def test_profile_is_valid(tmp_path, profile):
    path = write(tmp_path, f"profile: {profile}\n")
    config = load_config(path)
    assert config.profile_name == profile
    assert config.combos
    # Her combo çözülebiliyor mu?
    for combo in config.combos:
        assert describe_combo(combo, config.skillbar)


def test_local_config_overrides_profile(tmp_path):
    path = write(
        tmp_path,
        "profile: archer\n"
        "skillbar:\n"
        "  spike: f9\n"
        "timing:\n"
        "  jitter_pct: 0\n",
    )
    config = load_config(path)
    assert config.skillbar["spike"] == "f9"
    assert config.timing.jitter_pct == 0
    # Profildeki diğer tuşlar korunuyor.
    assert "arrow_shower" in config.skillbar


def test_missing_profile_reports_options(tmp_path):
    path = write(tmp_path, "profile: buyucu\n")
    with pytest.raises(ConfigError, match="profil bulunamadı"):
        load_config(path)


def test_missing_file(tmp_path):
    with pytest.raises(ConfigError, match="config dosyası yok"):
        load_config(tmp_path / "yok.yaml")


def test_example_config_is_loadable():
    from pathlib import Path

    example = Path(__file__).resolve().parent.parent / "config.example.yaml"
    config = load_config(example)
    assert config.profile_name == "archer"
    assert config.hotkeys.panic == "f12"


# -------------------------------------------------------- autocast ve duruş


def test_autocast_must_reference_known_combo():
    raw = dict(MINIMAL, autocast=[{"name": "x", "combo": "olmayan", "every_s": 10}])
    with pytest.raises(ConfigError, match="tanımsız bir comboyu"):
        AppConfig.from_dict(raw)


def test_autocast_rule_errors_are_wrapped():
    raw = dict(MINIMAL, autocast=[{"name": "x", "combo": "test", "key": "1", "every_s": 10}])
    with pytest.raises(ConfigError, match="autocast kuralı hatalı"):
        AppConfig.from_dict(raw)


def test_autocast_key_is_normalized():
    raw = dict(MINIMAL, autocast=[{"name": "x", "key": "F5", "every_s": 10}])
    assert AppConfig.from_dict(raw).autocast[0].key == "f5"


def test_restore_stance_requires_stance_key():
    raw = {
        "skillbar": {"spike": "1"},
        "combos": [{"name": "t", "restore_stance": True, "steps": [{"skill": "spike"}]}],
    }
    with pytest.raises(ConfigError, match="stance_key"):
        AppConfig.from_dict(raw)

    ok = AppConfig.from_dict(dict(raw, stance_key="z"))
    assert ok.stance_key == "z"


def test_archer_profile_has_stance_and_autocast(tmp_path):
    config = load_config(write(tmp_path, "profile: archer\n"))
    assert config.stance_key == "z"
    assert any(rule.name == "cure" for rule in config.autocast)
    assert any(combo.restore_stance for combo in config.combos)


def test_priest_profile_has_genie_rules(tmp_path):
    config = load_config(write(tmp_path, "profile: priest\n"))
    names = {rule.name for rule in config.autocast}
    assert {"buff-yenile", "parazit-temizle", "malice"} <= names
