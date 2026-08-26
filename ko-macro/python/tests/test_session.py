"""Oturum bekçisi testleri.

Saatlerce başında durmadan farm ederken makronun ne zaman durduğu, ne zaman
durmadığı kadar önemli. Burada her kural tek tek doğrulanıyor.
"""

from __future__ import annotations

import pytest

from ko_macro.session import SessionGuard, SessionLimits

MINUTE = 60.0


def guard(**kwargs) -> SessionGuard:
    instance = SessionGuard(limits=SessionLimits(**kwargs))
    instance.start(0.0)
    return instance


# ------------------------------------------------------------------ ölüm


def test_death_needs_several_consecutive_low_reads():
    """Tek yanlış okuma ölüm saydırmamalı."""
    watcher = guard(death_reads=3, idle_minutes=None)

    assert watcher.check(1.0, hp_pct=0.0) is None
    assert watcher.check(2.0, hp_pct=0.0) is None
    assert watcher.check(3.0, hp_pct=0.0) == "öldün (can sıfır)"


def test_a_recovered_reading_resets_the_death_counter():
    watcher = guard(death_reads=3, idle_minutes=None)

    watcher.check(1.0, hp_pct=0.0)
    watcher.check(2.0, hp_pct=0.0)
    watcher.check(3.0, hp_pct=0.9)     # bar yeniden okundu, canlıymışız
    assert watcher.check(4.0, hp_pct=0.0) is None


def test_healthy_player_is_never_dead():
    watcher = guard(death_reads=1, idle_minutes=None)
    for moment in range(1, 20):
        assert watcher.check(float(moment), hp_pct=0.5) is None


def test_death_detection_can_be_turned_off():
    watcher = guard(stop_on_death=False, death_reads=1, idle_minutes=None)
    assert watcher.check(1.0, hp_pct=0.0) is None


def test_no_health_reading_means_no_death_check():
    # vitals kapalıysa can okunamaz; bu ölüm sayılmamalı.
    watcher = guard(death_reads=1, idle_minutes=None)
    assert watcher.check(1.0, hp_pct=None) is None


# ------------------------------------------------------------------ sınırlar


def test_kill_limit_stops_the_session():
    watcher = guard(max_kills=3, idle_minutes=None)
    for moment in (1.0, 2.0, 3.0):
        watcher.note_kill(moment)
    assert watcher.check(4.0) == "kill sınırı doldu (3)"


def test_kill_limit_not_reached_keeps_going():
    watcher = guard(max_kills=3, idle_minutes=None)
    watcher.note_kill(1.0)
    assert watcher.check(2.0) is None


def test_time_limit_stops_the_session():
    watcher = guard(max_minutes=30, idle_minutes=None)
    assert watcher.check(29 * MINUTE) is None
    assert "süre doldu" in (watcher.check(30 * MINUTE) or "")


def test_idle_stops_when_no_kill_arrives():
    watcher = guard(idle_minutes=10)
    assert watcher.check(9 * MINUTE) is None
    assert "kill yok" in (watcher.check(10 * MINUTE) or "")


def test_a_kill_resets_the_idle_timer():
    watcher = guard(idle_minutes=10)
    watcher.note_kill(9 * MINUTE)
    assert watcher.check(18 * MINUTE) is None      # son kill'den 9 dk
    assert watcher.check(19 * MINUTE) is not None  # 10 dk


def test_unlimited_session_never_stops_by_itself():
    watcher = guard(max_kills=None, max_minutes=None, idle_minutes=None)
    assert watcher.check(100 * MINUTE, hp_pct=0.8) is None


# ------------------------------------------------------------------- durum


def test_reason_is_remembered():
    watcher = guard(max_kills=1, idle_minutes=None)
    watcher.note_kill(1.0)
    first = watcher.check(2.0)
    assert watcher.stopped is True
    # Sonraki kontroller aynı sebebi vermeli, yeniden hesaplamamalı.
    assert watcher.check(500 * MINUTE, hp_pct=0.0) == first


def test_start_clears_previous_state():
    watcher = guard(max_kills=1, idle_minutes=None)
    watcher.note_kill(1.0)
    watcher.check(2.0)
    assert watcher.stopped is True

    watcher.start(100.0)
    assert watcher.stopped is False
    assert watcher.kills == 0
    assert watcher.check(101.0) is None


def test_idle_seconds_tracks_the_last_kill():
    watcher = guard()
    watcher.note_kill(50.0)
    assert watcher.idle_seconds(80.0) == 30.0


# ----------------------------------------------------------------- ayarlar


def test_defaults_stop_on_idle_and_death():
    limits = SessionLimits.from_dict({})
    assert limits.idle_minutes == 10.0
    assert limits.stop_on_death is True
    assert limits.max_kills is None


def test_zero_disables_a_limit():
    limits = SessionLimits.from_dict({"idle_minutes": 0})
    assert limits.idle_minutes is None


def test_rejects_bad_values():
    with pytest.raises(ValueError, match="death_reads"):
        SessionLimits.from_dict({"death_reads": 0})
    with pytest.raises(ValueError, match="death_hp_pct"):
        SessionLimits.from_dict({"death_hp_pct": 500})
