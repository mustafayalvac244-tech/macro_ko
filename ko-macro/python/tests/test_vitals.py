"""Can/mana okuma ve pot seçimi testleri."""

from __future__ import annotations

from ko_macro.config import BarRegion, PotionRule, VitalsConfig
from ko_macro.transport import DryRunTransport
from ko_macro.vitals import (
    DamageWatch,
    StaticSampler,
    TargetState,
    VitalsMonitor,
    color_matches,
    read_bar,
)

HP = BarRegion(x0=40, x1=190, y=44, samples=20, color=(168, 32, 32), tolerance=60)
MP = BarRegion(x0=40, x1=190, y=58, samples=20, color=(168, 32, 32), tolerance=60)


def make_monitor(hp: float = 1.0, mp: float = 1.0, **kwargs) -> VitalsMonitor:
    config = VitalsConfig(
        enabled=True,
        poll_ms=kwargs.pop("poll_ms", 0),
        hp=HP,
        mp=MP,
        hp_potions=kwargs.pop("hp_potions", []),
        mp_potions=kwargs.pop("mp_potions", []),
        **kwargs,
    )
    sampler = StaticSampler({HP.y: hp, MP.y: mp})
    return VitalsMonitor(config=config, sampler=sampler)


# ------------------------------------------------------------------ bar okuma


def test_color_matches_within_tolerance():
    assert color_matches((170, 35, 30), (168, 32, 32), 60)
    assert not color_matches((10, 200, 10), (168, 32, 32), 20)


def test_read_bar_returns_fraction():
    sampler = StaticSampler({HP.y: 0.5})
    assert read_bar(sampler, HP) == 0.5


def test_read_bar_empty_and_full():
    assert read_bar(StaticSampler({HP.y: 0.0}), HP) == 0.0
    assert read_bar(StaticSampler({HP.y: 1.0}), HP) == 1.0


# ------------------------------------------------------------------ pot seçimi


def test_picks_strongest_potion_when_critically_low():
    rules = [
        PotionRule(below_pct=35, key="8", label="büyük"),
        PotionRule(below_pct=70, key="7", label="minor"),
    ]
    monitor = make_monitor(hp=0.2, hp_potions=rules)
    chosen = monitor.pick_potion(rules, 0.2, now=0.0)
    assert chosen is not None and chosen.label == "büyük"


def test_picks_minor_potion_for_light_damage():
    rules = [
        PotionRule(below_pct=35, key="8", label="büyük"),
        PotionRule(below_pct=70, key="7", label="minor"),
    ]
    monitor = make_monitor(hp=0.6, hp_potions=rules)
    chosen = monitor.pick_potion(rules, 0.6, now=0.0)
    assert chosen is not None and chosen.label == "minor"


def test_no_potion_when_healthy():
    rules = [PotionRule(below_pct=50, key="8")]
    monitor = make_monitor(hp=0.9, hp_potions=rules)
    assert monitor.pick_potion(rules, 0.9, now=0.0) is None


def test_potion_cooldown_prevents_spam():
    rules = [PotionRule(below_pct=90, key="8", cooldown_ms=1000)]
    monitor = make_monitor(hp=0.2, hp_potions=rules)
    transport = DryRunTransport()

    monitor.tick(transport, now=0.0)
    monitor.tick(transport, now=0.3)   # cooldown'da
    monitor.tick(transport, now=1.5)   # cooldown bitti

    presses = [action for action in transport.actions if action.target == "8"]
    assert len(presses) == 2


def test_tick_respects_poll_interval():
    rules = [PotionRule(below_pct=90, key="8", cooldown_ms=0)]
    monitor = make_monitor(hp=0.2, hp_potions=rules, poll_ms=500)
    transport = DryRunTransport()

    monitor.tick(transport, now=0.0)
    monitor.tick(transport, now=0.1)   # henüz okuma zamanı değil
    assert len([a for a in transport.actions if a.target == "8"]) == 1


def test_disabled_monitor_does_nothing():
    monitor = make_monitor(hp=0.1, hp_potions=[PotionRule(below_pct=90, key="8")])
    monitor.config.enabled = False
    transport = DryRunTransport()
    assert monitor.tick(transport, now=0.0) == []


def test_combo_paused_below_threshold():
    monitor = make_monitor(hp=0.1, pause_combo_below_hp=25)
    monitor.read(now=0.0)
    assert monitor.combo_allowed() is False

    healthy = make_monitor(hp=0.8, pause_combo_below_hp=25)
    healthy.read(now=0.0)
    assert healthy.combo_allowed() is True


def test_combo_allowed_without_reading():
    monitor = make_monitor(pause_combo_below_hp=25)
    assert monitor.combo_allowed() is True


# --------------------------------------------------------------- hasar takibi


def test_damage_watch_detects_progress():
    watch = DamageWatch(stall_seconds=2.0)
    watch.reset(0.0)
    assert watch.update(TargetState(present=True, hp_pct=0.9), 1.0) is True
    assert watch.update(TargetState(present=True, hp_pct=0.9), 2.0) is False


def test_damage_watch_flags_stall():
    watch = DamageWatch(stall_seconds=2.0)
    watch.reset(0.0)
    watch.update(TargetState(present=True, hp_pct=0.9), 0.0)
    assert watch.stalled(1.0) is False
    assert watch.stalled(3.0) is True


def test_damage_watch_resets_on_new_damage():
    watch = DamageWatch(stall_seconds=2.0)
    watch.reset(0.0)
    watch.update(TargetState(present=True, hp_pct=0.9), 0.0)
    watch.update(TargetState(present=True, hp_pct=0.5), 1.5)
    assert watch.stalled(2.0) is False


def test_screen_samplers_can_be_constructed():
    """Ekran okuyucuları kurulabilmeli.

    mss import'u tembel olduğu için burada ekran olmadan da kurulur; bu test
    eksik import gibi hataları yakalar (testler bunları hiç kurmadığı sürece
    böyle bir hata üretime kadar gider).
    """
    from ko_macro.calibrate import MSSScreen
    from ko_macro.vitals import MSSSampler

    assert MSSSampler() is not None
    assert MSSScreen is not None
