"""Motor bağlantıları.

İş parçacığı başlatmadan, motorun iç yollarını doğrudan çağırarak test eder:
autocast gerçekten tuşa basıyor mu, yardımcı makrolar kısayola bağlanıyor mu.
"""

from __future__ import annotations

from ko_macro.clock import FakeClock
from ko_macro.config import AppConfig
from ko_macro.runtime import MacroEngine, Request
from ko_macro.transport import DryRunTransport

BASE = {
    "skillbar": {"spike": "1", "heal": "2"},
    "combos": [
        {"name": "nuke", "steps": [{"skill": "spike", "hold_ms": 10, "gap_ms": 10}],
         "burst": False},
        {"name": "heal", "hotkey": "f1",
         "steps": [{"skill": "heal", "hold_ms": 10, "gap_ms": 10}], "burst": False},
    ],
}


def build(**overrides) -> tuple[MacroEngine, DryRunTransport]:
    raw = dict(BASE)
    raw.update(overrides)
    transport = DryRunTransport()
    engine = MacroEngine(
        config=AppConfig.from_dict(raw),
        transport=transport,
        clock=FakeClock(),
    )
    return engine, transport


def taps(transport: DryRunTransport) -> list[str]:
    return [action.target for action in transport.actions if action.kind == "tap"]


# ------------------------------------------------------------------- çözümleme


def test_resolves_regular_combo():
    engine, _ = build()
    assert engine._resolve_combo("nuke") is not None


def test_resolves_utility_macro():
    engine, _ = build(utility={"repair_keys": ["r", "enter"]})
    combo = engine._resolve_combo("repair")
    assert combo is not None
    assert [step.key for step in combo.steps] == ["r", "enter"]


def test_unknown_name_resolves_to_none():
    engine, _ = build()
    assert engine._resolve_combo("yok") is None


# --------------------------------------------------------------------- autocast


def test_autocast_runs_a_utility_macro():
    engine, transport = build(
        utility={"repair_keys": ["r", "enter"]},
        autocast=[{"name": "oto-tamir", "combo": "repair", "every_s": 100}],
    )
    engine.autocaster.prime(0.0)
    engine._pump_autocast(now=1000.0)

    assert taps(transport) == ["r", "enter"]


def test_autocast_runs_a_bare_key():
    engine, transport = build(autocast=[{"name": "swift", "key": "7", "every_s": 100}])
    engine.autocaster.prime(0.0)
    engine._pump_autocast(now=1000.0)
    assert taps(transport) == ["7"]


def test_autocast_does_not_repeat_within_interval():
    engine, transport = build(autocast=[{"name": "swift", "key": "7", "every_s": 100}])
    engine.autocaster.prime(0.0)
    engine._pump_autocast(now=1000.0)
    engine._pump_autocast(now=1001.0)
    assert taps(transport) == ["7"]


def test_autocast_skipped_while_a_combo_runs():
    engine, transport = build(autocast=[{"name": "swift", "key": "7", "every_s": 100}])
    engine.autocaster.prime(0.0)
    engine._busy.set()                 # combo çalışıyormuş gibi
    engine._pump_background()
    assert taps(transport) == []


def test_autocast_farming_gate():
    engine, transport = build(
        autocast=[{"name": "malice", "key": "3", "every_s": 10, "only_when_farming": True}]
    )
    engine.autocaster.prime(0.0)
    engine.farm_enabled = False
    engine._pump_autocast(now=1000.0)
    assert taps(transport) == []

    engine.farm_enabled = True
    engine._pump_autocast(now=1000.0)
    assert taps(transport) == ["3"]


# ------------------------------------------------------------------ kısayollar


def test_utility_macros_get_hotkeys():
    engine, _ = build(utility={"repair_keys": ["r"], "hotkeys": {"repair": "f7"}})
    engine._bind_hotkeys()
    assert "f7" in engine.hotkeys.bindings


def test_combo_and_control_hotkeys_are_bound():
    engine, _ = build()
    engine._bind_hotkeys()
    bindings = engine.hotkeys.bindings
    assert "f1" in bindings          # combo
    assert "f12" in bindings         # panik
    assert "f9" in bindings          # başlat/durdur


def test_utility_hotkey_triggers_the_macro():
    engine, transport = build(utility={"repair_keys": ["r"], "hotkeys": {"repair": "f7"}})
    engine._bind_hotkeys()
    engine.hotkeys.bindings["f7"]()          # kısayola basılmış gibi
    engine._handle(engine._queue.get_nowait())
    assert taps(transport) == ["r"]


# ---------------------------------------------------------------------- istekler


def test_requests_are_ignored_while_busy():
    engine, _ = build()
    engine._busy.set()
    engine.request_combo("nuke")
    engine.request_utility("repair")
    assert engine._queue.empty()


def test_toggle_farm_flips_state():
    engine, _ = build()
    initial = engine.farm_enabled
    engine._handle(Request("toggle_farm"))
    assert engine.farm_enabled is not initial


def test_unknown_combo_request_records_error():
    engine, _ = build()
    engine._handle(Request("combo", "yok"))
    assert engine.error is not None and "yok" in engine.error


# ------------------------------------------------------------ oturum bekçisi


def test_farm_stops_when_the_kill_limit_is_reached():
    engine, _ = build(farm={"enabled": True}, session={"max_kills": 2, "idle_minutes": 0})
    engine.guard.start(0.0)
    assert engine.farm_enabled is True

    engine._record_farm_kill()
    engine._record_farm_kill()
    engine._check_session(now=1.0)

    assert engine.farm_enabled is False
    assert "kill sınırı" in (engine.stop_reason or "")


def test_farm_stops_when_idle_too_long():
    engine, _ = build(farm={"enabled": True}, session={"idle_minutes": 5})
    engine.guard.start(0.0)

    engine._check_session(now=4 * 60.0)
    assert engine.farm_enabled is True

    engine._check_session(now=5 * 60.0)
    assert engine.farm_enabled is False
    assert "kill yok" in (engine.stop_reason or "")


def test_stopping_aborts_whatever_is_running():
    engine, transport = build(
        farm={"enabled": True}, session={"max_kills": 1, "idle_minutes": 0}
    )
    engine.guard.start(0.0)
    engine._record_farm_kill()
    engine._check_session(now=1.0)

    assert any(a.kind == "release_all" for a in transport.actions)


def test_no_check_while_farm_is_off():
    engine, _ = build(farm={"enabled": False}, session={"max_kills": 1, "idle_minutes": 0})
    engine.guard.start(0.0)
    engine._record_farm_kill()
    engine._check_session(now=1.0)
    # Farm zaten kapalıyken sebep üretmemeli.
    assert engine.stop_reason is None


def test_toggling_farm_back_on_starts_a_new_session():
    engine, _ = build(farm={"enabled": True}, session={"max_kills": 1, "idle_minutes": 0})
    engine.guard.start(0.0)
    engine._record_farm_kill()
    engine._check_session(now=1.0)
    assert engine.farm_enabled is False

    engine._handle(Request("toggle_farm"))
    assert engine.farm_enabled is True
    assert engine.stop_reason is None
    assert engine.guard.kills == 0


def test_status_carries_the_stop_reason():
    engine, _ = build(farm={"enabled": True}, session={"max_kills": 1, "idle_minutes": 0})
    engine.guard.start(0.0)
    engine._record_farm_kill()
    engine._check_session(now=1.0)

    status = engine.status()
    assert status["stop_reason"] is not None
    assert status["session_kills"] == 1
