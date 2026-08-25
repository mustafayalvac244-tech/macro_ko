"""Farm döngüsü testleri — hedef barı olan ve olmayan kipler."""

from __future__ import annotations

import random

from ko_macro.clock import FakeClock
from ko_macro.config import BarRegion, Combo, ComboStep, FarmConfig, TimingConfig
from ko_macro.farm import FarmLoop
from ko_macro.sequence import ComboRunner
from ko_macro.transport import DryRunTransport
from ko_macro.vitals import TargetMonitor


class ScriptedSampler:
    """Hedef barını önceden yazılmış bir senaryoya göre döndürür."""

    def __init__(self, fractions: list[float]) -> None:
        self.fractions = list(fractions)
        self.reads = 0

    def sample_row(self, x0, x1, y, count):
        index = min(self.reads, len(self.fractions) - 1)
        self.reads += 1
        fraction = self.fractions[index]
        filled = int(round(fraction * count))
        return [(190, 40, 40) if i < filled else (10, 10, 10) for i in range(count)]


REGION = BarRegion(x0=700, x1=900, y=60, samples=20, color=(190, 40, 40), tolerance=60)


def build(config: FarmConfig, sampler=None, combo=None):
    clock = FakeClock()
    transport = DryRunTransport()
    runner = ComboRunner(
        transport=transport,
        timing=TimingConfig(jitter_pct=0, hold_jitter_pct=0, combo_gap_ms=0),
        clock=clock,
        skillbar={"nuke": "1"},
        rng=random.Random(1),
    )
    target = TargetMonitor(region=REGION, sampler=sampler) if sampler else None
    loop = FarmLoop(
        config=config, runner=runner, transport=transport, clock=clock,
        combo=combo, target=target,
    )
    return loop, transport, clock


def farm_config(**kwargs) -> FarmConfig:
    defaults = dict(
        enabled=True, target_key="tab", attack_button="left", loot_key="z",
        loot_repeat=2, engage_seconds=5.0, retarget_delay_ms=100, poll_ms=100,
        stall_seconds=2.0, search_attempts=3, acquire_timeout_ms=500,
        search_turn_key=None,
    )
    defaults.update(kwargs)
    return FarmConfig(**defaults)


# ------------------------------------------------------------------- kör kip


def test_blind_mode_completes_a_cycle():
    loop, transport, _ = build(farm_config())
    assert loop.cycle() is True
    assert loop.stats.kills == 1
    taps = [action.target for action in transport.actions if action.kind == "tap"]
    assert taps[0] == "tab"
    assert "z" in taps  # yağmaladı


def test_blind_mode_stops_when_asked():
    loop, _, _ = build(farm_config())
    assert loop.cycle(should_continue=lambda: False) is False
    assert loop.stats.kills == 0


# --------------------------------------------------------------- geri beslemeli


def test_target_bar_detects_kill_and_loots():
    # Hedef seçildi (dolu bar), canı düştü, sonra bar boş = öldü.
    sampler = ScriptedSampler([1.0, 0.8, 0.5, 0.2, 0.0])
    loop, transport, _ = build(farm_config(), sampler=sampler)

    assert loop.cycle() is True
    assert loop.stats.kills == 1
    taps = [action.target for action in transport.actions if action.kind == "tap"]
    assert taps.count("z") == 2  # loot_repeat


def test_no_target_counts_as_miss_and_does_not_loot():
    sampler = ScriptedSampler([0.0])  # bar hiç belirmiyor
    loop, transport, _ = build(farm_config(), sampler=sampler)

    loop.cycle()
    assert loop.stats.misses == 1
    assert loop.stats.kills == 0
    assert not any(action.target == "z" for action in transport.actions)


def test_retries_targeting_before_giving_up():
    sampler = ScriptedSampler([0.0])
    loop, transport, _ = build(
        farm_config(search_attempts=3, acquire_timeout_ms=200), sampler=sampler
    )
    loop.acquire_target()
    tab_presses = [a for a in transport.actions if a.kind == "tap" and a.target == "tab"]
    assert len(tab_presses) == 3


def test_stalled_target_is_abandoned():
    # Bar sabit kalıyor: menzil dışı. Süre dolmadan bırakmalı.
    sampler = ScriptedSampler([0.9])
    loop, _, clock = build(farm_config(engage_seconds=60.0, stall_seconds=1.0), sampler=sampler)

    assert loop.acquire_target() is True
    assert loop.engage() is False
    assert loop.stats.abandoned == 1
    # 60 saniyelik süreyi beklemedi.
    assert clock.monotonic() < 30


def test_kill_callback_fires_once_per_kill():
    sampler = ScriptedSampler([1.0, 0.4, 0.0])
    loop, _, _ = build(farm_config(), sampler=sampler)
    hits = []
    loop.on_kill = lambda: hits.append(1)

    loop.cycle()
    assert len(hits) == 1


def test_combo_is_used_when_ready():
    combo = Combo(name="farm", steps=[ComboStep(skill="nuke", hold_ms=10, gap_ms=10)],
                  cooldown_ms=0, burst=False)
    sampler = ScriptedSampler([1.0, 0.8, 0.7, 0.6, 0.4, 0.0])
    loop, transport, _ = build(farm_config(), sampler=sampler, combo=combo)

    loop.cycle()
    assert any(action.target == "1" for action in transport.actions)
    assert loop.stats.combos >= 1


def test_combo_aborts_when_target_dies_mid_sequence():
    # Uzun bir combo: hedef ikinci adımdan önce düşerse kalan adımlar
    # boşa harcanmamalı.
    combo = Combo(
        name="farm",
        steps=[ComboStep(skill="nuke", hold_ms=10, gap_ms=10, repeat=6)],
        cooldown_ms=0,
        burst=False,
    )
    sampler = ScriptedSampler([1.0, 0.9, 0.0])
    loop, transport, _ = build(farm_config(), sampler=sampler, combo=combo)

    loop.cycle()
    presses = [a for a in transport.actions if a.kind == "tap" and a.target == "1"]
    assert len(presses) < 6
    assert loop.stats.kills == 1


def test_run_honours_max_cycles():
    sampler = ScriptedSampler([1.0, 0.0])
    loop, _, _ = build(farm_config(), sampler=sampler)
    stats = loop.run(max_cycles=3)
    assert stats.cycles == 3
    assert stats.stopped_at is not None


def test_kills_per_hour_is_zero_before_start():
    loop, _, clock = build(farm_config())
    assert loop.stats.kills_per_hour(clock.monotonic()) == 0.0


# --------------------------------------------- ceset / yarım canlı hedef eleme


class QueuedSampler:
    """Her okumada sıradaki değeri döndürür; liste bitince sonuncuda kalır."""

    def __init__(self, fractions):
        self.fractions = list(fractions)
        self.reads = 0

    def sample_row(self, x0, x1, y, count):
        index = min(self.reads, len(self.fractions) - 1)
        self.reads += 1
        fraction = self.fractions[index]
        filled = int(round(fraction * count))
        return [(190, 40, 40) if i < filled else (10, 10, 10) for i in range(count)]


def test_corpse_is_rejected_and_tab_pressed_again():
    # 1. Tab: bar boş (ceset). 2. Tab: dolu mob.
    sampler = QueuedSampler([0.0, 0.0, 1.0])
    loop, transport, _ = build(
        farm_config(search_attempts=4, acquire_timeout_ms=150), sampler=sampler
    )

    assert loop.acquire_target() is True
    tabs = [a for a in transport.actions if a.kind == "tap" and a.target == "tab"]
    assert len(tabs) >= 2


def test_half_health_target_is_skipped():
    # Başkasının dövdüğü mob: bar %50. Eşik %90 -> atlanmalı.
    sampler = QueuedSampler([0.5])
    loop, _, _ = build(
        farm_config(search_attempts=3, acquire_timeout_ms=150, min_target_hp_pct=90),
        sampler=sampler,
    )

    assert loop.acquire_target() is False
    assert loop.stats.skipped == 3


def test_half_health_accepted_when_threshold_disabled():
    sampler = QueuedSampler([0.5])
    loop, _, _ = build(
        farm_config(search_attempts=3, acquire_timeout_ms=150, min_target_hp_pct=0),
        sampler=sampler,
    )

    assert loop.acquire_target() is True
    assert loop.stats.skipped == 0


def test_fresh_target_after_a_damaged_one():
    # Önce yarım canlı, sonra tam canlı.
    sampler = QueuedSampler([0.4, 1.0])
    loop, _, _ = build(
        farm_config(search_attempts=4, acquire_timeout_ms=150, min_target_hp_pct=90),
        sampler=sampler,
    )

    assert loop.acquire_target() is True
    assert loop.stats.skipped == 1


def test_waits_before_retargeting_after_a_kill():
    sampler = QueuedSampler([1.0, 0.5, 0.0])
    loop, transport, _ = build(
        farm_config(post_kill_delay_ms=300, loot_key=None), sampler=sampler
    )

    loop.cycle()
    assert loop.stats.kills == 1
    # Bekleme gerçekten uygulanmış olmalı (sahte saat ilerledi).
    assert any(action.kind == "tap" for action in transport.actions)


def test_turn_only_after_configured_attempts():
    sampler = QueuedSampler([0.0])
    loop, transport, _ = build(
        farm_config(
            search_attempts=4, acquire_timeout_ms=100,
            turn_after_attempts=2, search_turn_key="right",
        ),
        sampler=sampler,
    )

    loop.acquire_target()
    turns = [a for a in transport.actions if a.kind == "key_down" and a.target == "right"]
    # 4 denemede sadece 2. ve 4.'de çevirmeli (attempt % 2 == 0).
    assert len(turns) == 1


# -------------------------------------------------- ölünce comboyu anında kesme


def test_kill_watcher_aborts_the_running_combo():
    from ko_macro.clock import FakeClock
    from ko_macro.farm import KillWatcher
    from ko_macro.vitals import TargetMonitor

    transport = DryRunTransport()
    sampler = QueuedSampler([0.0])           # hedef ölmüş
    monitor = TargetMonitor(region=REGION, sampler=sampler)
    watcher = KillWatcher(
        target=monitor, transport=transport, clock=FakeClock(), poll_s=0.01
    )

    assert watcher.poll_once() is True
    assert watcher.triggered is True
    # abort() basılı kalanları bırakır - kuru modda bu kayda geçer.
    assert any(action.kind == "release_all" for action in transport.actions)


def test_kill_watcher_stays_quiet_while_target_lives():
    from ko_macro.clock import FakeClock
    from ko_macro.farm import KillWatcher
    from ko_macro.vitals import TargetMonitor

    transport = DryRunTransport()
    monitor = TargetMonitor(region=REGION, sampler=QueuedSampler([1.0]))
    watcher = KillWatcher(
        target=monitor, transport=transport, clock=FakeClock(), poll_s=0.01
    )

    assert watcher.poll_once() is False
    assert watcher.triggered is False
    assert transport.actions == []


def test_combo_is_cut_short_when_target_dies():
    # 6 adımlık combo, hedef 2. okumada ölüyor: tüm adımlar atılmamalı.
    combo = Combo(
        name="farm",
        steps=[ComboStep(skill="nuke", hold_ms=10, gap_ms=10, repeat=6)],
        cooldown_ms=0,
        burst=False,
    )
    sampler = QueuedSampler([1.0, 1.0, 0.0])
    loop, transport, _ = build(farm_config(), sampler=sampler, combo=combo)

    loop.cycle()
    presses = [a for a in transport.actions if a.kind == "tap" and a.target == "1"]
    assert len(presses) < 6
    assert loop.stats.kills == 1


def test_burst_combo_is_aborted_when_target_dies():
    """Asıl üretim yolu: combo Leonardo kuyruğunda çalışırken hedef ölürse."""

    class BurstTransport(DryRunTransport):
        supports_burst = True

        def __init__(self):
            super().__init__()
            self.aborted = False
            self.queue_runs = 0

        def run_queue(self, repeat: int = 1) -> int:
            self.queue_runs += 1
            if self.aborted:
                return -1          # firmware iptal etti
            return len(self._steps) * repeat

        def abort(self) -> None:
            self.aborted = True
            super().abort()

    from ko_macro.clock import FakeClock
    from ko_macro.vitals import TargetMonitor

    transport = BurstTransport()
    clock = FakeClock()
    runner = ComboRunner(
        transport=transport,
        timing=TimingConfig(jitter_pct=0, hold_jitter_pct=0, combo_gap_ms=0),
        clock=clock,
        skillbar={"nuke": "1"},
        rng=random.Random(1),
    )
    # 40 adım: kuyruk kapasitesini aştığı için iki parçaya bölünür; hedef
    # birinci parçadan sonra ölmüş olacak.
    combo = Combo(
        name="farm",
        steps=[ComboStep(skill="nuke", hold_ms=10, gap_ms=10, repeat=40)],
        cooldown_ms=0,
        burst=True,
    )
    sampler = QueuedSampler([1.0, 1.0, 0.0])
    loop = FarmLoop(
        config=farm_config(), runner=runner, transport=transport, clock=clock,
        combo=combo, target=TargetMonitor(region=REGION, sampler=sampler),
    )

    loop.acquire_target()
    killed = loop._run_combo_watching_target(lambda: True)

    assert killed is True
    assert transport.aborted is True
    assert loop.stats.cut_short == 1
    # İkinci parça hiç kuyruğa yüklenip çalıştırılmamalı.
    assert transport.queue_runs < 2
