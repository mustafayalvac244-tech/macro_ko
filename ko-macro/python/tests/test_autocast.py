"""Otomatik yetenek (autocast) testleri."""

from __future__ import annotations

import random

import pytest

from ko_macro.autocast import AutoCaster, AutoCastRule


def rule(**kwargs) -> AutoCastRule:
    defaults = dict(name="test", combo="x", every_s=10.0)
    defaults.update(kwargs)
    return AutoCastRule(**defaults)


def caster(*rules: AutoCastRule) -> AutoCaster:
    instance = AutoCaster(rules=list(rules), rng=random.Random(42))
    instance.prime(0.0)
    return instance


# ------------------------------------------------------------------ doğrulama


def test_rule_needs_exactly_one_action():
    with pytest.raises(ValueError, match="tam olarak biri"):
        AutoCastRule(name="x", combo="a", key="b", every_s=5)
    with pytest.raises(ValueError, match="tam olarak biri"):
        AutoCastRule(name="x", every_s=5)


def test_rule_needs_a_trigger():
    with pytest.raises(ValueError, match="en az bir tetikleyici"):
        AutoCastRule(name="x", combo="a")


def test_condition_only_rule_is_valid():
    assert AutoCastRule(name="heal", combo="heal", when_hp_below=50).every_s == 0.0


def test_from_dict_reads_all_fields():
    parsed = AutoCastRule.from_dict(
        {"name": "buff", "combo": "buff", "every_s": 900, "only_when_farming": True}
    )
    assert parsed.every_s == 900
    assert parsed.only_when_farming is True


# ------------------------------------------------------------------ zamanlama


def test_prime_spreads_first_trigger():
    rules = [rule(name=f"r{i}", every_s=100.0) for i in range(5)]
    instance = caster(*rules)
    firsts = {instance.remaining(r, 0.0) for r in rules}
    assert len(firsts) > 1              # hepsi aynı anda tetiklenmiyor
    assert all(0 <= value <= 100 for value in firsts)


def test_rule_fires_after_interval():
    target = rule(every_s=10.0)
    instance = caster(target)
    instance.mark(target, 0.0)

    assert instance.due(5.0) == []
    assert instance.due(60.0) == [target]


def test_mark_applies_jitter_to_interval():
    target = rule(every_s=100.0, jitter_pct=20.0)
    instance = caster(target)
    intervals = []
    for _ in range(20):
        instance.mark(target, 0.0)
        intervals.append(instance.remaining(target, 0.0))
    assert len(set(intervals)) > 1
    assert all(80 <= value <= 120 for value in intervals)


def test_disabled_rule_never_fires():
    target = rule(enabled=False)
    assert caster(target).due(1000.0) == []


# ------------------------------------------------------------------- koşullar


def test_hp_condition_gates_firing():
    target = rule(when_hp_below=50.0, every_s=0.0)
    instance = caster(target)

    assert instance.due(100.0, hp_pct=0.8) == []
    assert instance.due(100.0, hp_pct=0.3) == [target]


def test_hp_condition_needs_a_reading():
    target = rule(when_hp_below=50.0, every_s=0.0)
    # Can okunamıyorsa tetiklenmez - kör basmaktansa hiç basmamak yeğdir.
    assert caster(target).due(100.0, hp_pct=None) == []


def test_mp_condition_gates_firing():
    target = rule(when_mp_below=40.0, every_s=0.0)
    instance = caster(target)
    assert instance.due(100.0, mp_pct=0.9) == []
    assert instance.due(100.0, mp_pct=0.2) == [target]


def test_interval_and_condition_must_both_hold():
    target = rule(every_s=10.0, when_hp_below=50.0)
    instance = caster(target)
    instance.mark(target, 0.0)

    assert instance.due(5.0, hp_pct=0.1) == []      # süre dolmadı
    assert instance.due(100.0, hp_pct=0.9) == []    # can yeterli
    assert instance.due(100.0, hp_pct=0.1) == [target]


def test_only_when_farming():
    target = rule(only_when_farming=True)
    instance = caster(target)
    assert instance.due(100.0, farming=False) == []
    assert instance.due(100.0, farming=True) == [target]


def test_condition_rule_has_short_relock():
    target = rule(when_hp_below=50.0, every_s=0.0)
    instance = caster(target)
    instance.mark(target, 10.0)
    # Art arda basmayı önleyen kısa kilit.
    assert instance.due(10.5, hp_pct=0.1) == []
    assert instance.due(12.0, hp_pct=0.1) == [target]


def test_multiple_rules_can_be_due_together():
    first = rule(name="a", every_s=1.0)
    second = rule(name="b", every_s=1.0)
    instance = caster(first, second)
    due = instance.due(500.0)
    assert {r.name for r in due} == {"a", "b"}
