"""Combo motoru testleri."""

from __future__ import annotations

import random

import pytest

from ko_macro.clock import FakeClock
from ko_macro.config import Combo, ComboStep, TimingConfig
from ko_macro.sequence import ComboRunner, apply_jitter, describe_combo, total_steps
from ko_macro.transport import DryRunTransport

SKILLBAR = {"spike": "1", "shower": "2", "shot": "3"}


def make_runner(transport=None, jitter=0.0, clock=None) -> ComboRunner:
    return ComboRunner(
        transport=transport or DryRunTransport(),
        timing=TimingConfig(jitter_pct=jitter, hold_jitter_pct=jitter, combo_gap_ms=0),
        clock=clock or FakeClock(),
        skillbar=SKILLBAR,
        rng=random.Random(1234),
    )


def make_combo(**kwargs) -> Combo:
    defaults = dict(
        name="test",
        steps=[
            ComboStep(skill="spike", hold_ms=40, gap_ms=100),
            ComboStep(skill="shot", hold_ms=40, gap_ms=150),
        ],
    )
    defaults.update(kwargs)
    return Combo(**defaults)


# ---------------------------------------------------------------------- jitter


def test_apply_jitter_zero_pct_is_exact():
    rng = random.Random(0)
    assert apply_jitter(120, 0, rng) == 120


def test_apply_jitter_stays_in_range():
    rng = random.Random(7)
    values = [apply_jitter(100, 10, rng) for _ in range(200)]
    assert all(90 <= value <= 110 for value in values)
    assert len(set(values)) > 1  # gerçekten değişiyor


def test_apply_jitter_never_negative():
    rng = random.Random(3)
    assert all(apply_jitter(2, 99, rng) >= 0 for _ in range(100))


# ------------------------------------------------------------------- planlama


def test_plan_resolves_skillbar():
    runner = make_runner()
    planned = runner.plan(make_combo())
    assert [step.key for step in planned] == ["1", "3"]


def test_plan_expands_repeat():
    runner = make_runner()
    combo = make_combo(steps=[ComboStep(skill="spike", repeat=3, gap_ms=10)])
    assert len(runner.plan(combo)) == 3
    assert total_steps(combo) == 3


def test_plan_rejects_unknown_skill():
    runner = make_runner()
    combo = make_combo(steps=[ComboStep(skill="yok")])
    with pytest.raises(Exception, match="tanımsız yetenek"):
        runner.plan(combo)


# ----------------------------------------------------------------- çalıştırma


def test_run_sequential_presses_keys_in_order():
    transport = DryRunTransport()
    runner = make_runner(transport)
    combo = make_combo(burst=False)
    result = runner.run(combo)

    taps = [action.target for action in transport.actions if action.kind == "tap"]
    assert taps == ["1", "3"]
    assert result.steps == 2
    assert not result.aborted


def test_run_uses_burst_when_supported():
    class BurstTransport(DryRunTransport):
        supports_burst = True

    transport = BurstTransport()
    runner = make_runner(transport)
    runner.run(make_combo(burst=True))

    # Burst yolunda tuşlar tek tek "tap" olarak değil, kuyruk üzerinden gider.
    assert [step.target for step in transport._steps] == ["1", "3"]


def test_burst_splits_long_combos_into_chunks():
    class BurstTransport(DryRunTransport):
        supports_burst = True

        def __init__(self):
            super().__init__()
            self.runs = 0

        def run_queue(self, repeat: int = 1) -> int:
            self.runs += 1
            return len(self._steps) * repeat

    transport = BurstTransport()
    runner = make_runner(transport)
    combo = make_combo(steps=[ComboStep(skill="spike", repeat=70, gap_ms=5)])
    result = runner.run(combo)

    assert transport.runs == 3  # 70 adım / 32 kapasite
    assert result.steps == 70


def test_run_repeats_rounds():
    transport = DryRunTransport()
    runner = make_runner(transport)
    result = runner.run(make_combo(burst=False), repeat=3)
    assert result.rounds == 3
    assert result.steps == 6


def test_should_continue_aborts_between_steps():
    transport = DryRunTransport()
    runner = make_runner(transport)
    calls = {"n": 0}

    def should_continue() -> bool:
        calls["n"] += 1
        return calls["n"] < 2

    result = runner.run(make_combo(burst=False), repeat=5, should_continue=should_continue)
    assert result.aborted
    assert result.rounds <= 1


# ------------------------------------------------------------------- cooldown


def test_cooldown_blocks_until_elapsed():
    clock = FakeClock()
    runner = make_runner(clock=clock)
    combo = make_combo(cooldown_ms=2000, burst=False)

    runner.run(combo)
    assert not runner.is_ready(combo)

    clock.advance(1.0)
    assert runner.remaining_cooldown(combo) == pytest.approx(1.0, abs=0.3)

    clock.advance(2.0)
    assert runner.is_ready(combo)


def test_combo_without_cooldown_is_always_ready():
    runner = make_runner()
    combo = make_combo(cooldown_ms=0, burst=False)
    runner.run(combo)
    assert runner.is_ready(combo)


# --------------------------------------------------------------------- gösterim


def test_describe_combo_is_readable():
    text = describe_combo(make_combo(), SKILLBAR)
    assert text == "1(spike) → 3(shot)"


def test_duration_accounts_for_repeat():
    combo = make_combo(steps=[ComboStep(skill="spike", hold_ms=40, gap_ms=60, repeat=2)])
    assert combo.duration_ms() == 200


# ------------------------------------------------------------------- duruş (Z)


def test_restore_stance_appends_stance_key():
    transport = DryRunTransport()
    runner = make_runner(transport)
    runner.stance_key = "z"
    result = runner.run(make_combo(burst=False, restore_stance=True))

    taps = [action.target for action in transport.actions if action.kind == "tap"]
    assert taps == ["1", "3", "z"]
    assert result.steps == 3


def test_stance_not_added_without_flag():
    transport = DryRunTransport()
    runner = make_runner(transport)
    runner.stance_key = "z"
    runner.run(make_combo(burst=False))
    assert "z" not in [action.target for action in transport.actions]


def test_stance_flag_without_key_is_a_no_op():
    transport = DryRunTransport()
    runner = make_runner(transport)  # stance_key yok
    runner.run(make_combo(burst=False, restore_stance=True))
    taps = [action.target for action in transport.actions if action.kind == "tap"]
    assert taps == ["1", "3"]
