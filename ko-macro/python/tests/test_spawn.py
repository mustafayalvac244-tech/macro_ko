"""Doğuş tahmin motoru testleri."""

from __future__ import annotations

import pytest

from ko_macro.spawn import (
    SpawnBook,
    SpawnError,
    SpawnPoint,
    fold_interval,
    format_eta,
    median,
    median_absolute_deviation,
    plan_route,
    predict,
)

HOUR = 3600.0
NOW = 1_700_000_000.0


def make_point(**kwargs) -> SpawnPoint:
    defaults = dict(
        id="felankor", name="Felankor", zone="Moradon",
        respawn_min_s=20 * 60, respawn_max_s=30 * 60,
    )
    defaults.update(kwargs)
    return SpawnPoint(**defaults)


# ------------------------------------------------------------------ istatistik


def test_median_handles_even_and_odd():
    assert median([3, 1, 2]) == 2
    assert median([4, 1, 2, 3]) == 2.5
    assert median([]) == 0.0


def test_mad_is_robust_to_outlier():
    tight = [100, 101, 99, 100]
    with_outlier = tight + [10_000]
    # Tek bir uç değer MAD'i ortalama kadar bozmaz.
    assert median_absolute_deviation(with_outlier) <= median_absolute_deviation(tight) + 1


def test_fold_interval_divides_missed_cycles():
    # 3 tur kaçırılmış: 3600 saniye aslında 3 x 1200.
    assert fold_interval(3600, 1200, 900, 1500) == 1200.0


def test_fold_interval_rejects_nonsense():
    assert fold_interval(50, 1200, 900, 1500) is None
    assert fold_interval(-5, 1200, 900, 1500) is None


# --------------------------------------------------------------------- öğrenme


def test_observed_intervals_fold_missed_kills():
    point = make_point(kills=[0, 1500, 3000, 7500])  # son aralık 3 turluk
    intervals = point.observed_intervals()
    assert len(intervals) == 3
    assert all(1200 <= value <= 1800 for value in intervals)


def test_learned_window_narrows_with_samples():
    # Hep 25 dakikada doğan bir boss: pencere daralmalı.
    kills = [NOW + index * 1500 for index in range(6)]
    point = make_point(kills=kills)
    low, high, samples = point.learned_window()
    assert samples == 5
    assert high - low < point.respawn_max_s - point.respawn_min_s


def test_learned_window_falls_back_without_samples():
    point = make_point(kills=[NOW])
    low, high, samples = point.learned_window()
    assert (low, high, samples) == (point.respawn_min_s, point.respawn_max_s, 0)


# --------------------------------------------------------------------- tahmin


def test_predict_without_kills_is_unknown():
    prediction = predict(make_point(), NOW)
    assert prediction.state == "bilinmiyor"
    assert prediction.window_open is None
    assert prediction.confidence == 0.0


def test_predict_waiting_state():
    point = make_point(kills=[NOW])
    prediction = predict(point, NOW + 60)
    assert prediction.state == "bekliyor"
    assert prediction.eta_s == pytest.approx(20 * 60 - 60)
    assert prediction.probability_now == 0.0


def test_predict_inside_window():
    point = make_point(kills=[NOW])
    prediction = predict(point, NOW + 25 * 60)
    assert prediction.state == "pencere"
    assert 0.0 < prediction.probability_now < 1.0


def test_predict_rolls_forward_after_missed_window():
    point = make_point(kills=[NOW])
    # İki tur geçmiş ve hiç kayıt girilmemiş.
    prediction = predict(point, NOW + 75 * 60)
    assert prediction.missed_cycles >= 1
    assert prediction.window_close is not None
    assert prediction.window_close > NOW + 75 * 60 - 60


def test_missed_cycles_reduce_confidence():
    kills = [NOW + index * 1500 for index in range(6)]
    fresh = predict(make_point(kills=kills), kills[-1] + 20 * 60)
    stale = predict(make_point(kills=kills), kills[-1] + 3 * HOUR)
    assert stale.confidence < fresh.confidence


# ----------------------------------------------------------------------- rota


def test_plan_route_prefers_imminent_window():
    soon = predict(make_point(id="a", name="A", kills=[NOW - 19 * 60]), NOW)
    later = predict(
        make_point(id="b", name="B", respawn_min_s=HOUR, respawn_max_s=HOUR + 600,
                   kills=[NOW - 60]),
        NOW,
    )
    route = plan_route([soon, later], NOW, default_travel_s=60)
    assert route[0].point_id == "a"


def test_plan_route_respects_horizon():
    far = predict(
        make_point(id="far", respawn_min_s=5 * HOUR, respawn_max_s=6 * HOUR, kills=[NOW]),
        NOW,
    )
    assert plan_route([far], NOW, horizon_s=600) == []


def test_plan_route_visits_each_point_once():
    predictions = [
        predict(make_point(id=f"p{i}", name=f"P{i}", kills=[NOW - 21 * 60]), NOW)
        for i in range(4)
    ]
    route = plan_route(predictions, NOW, default_travel_s=30, max_stops=10)
    assert len(route) == len({stop.point_id for stop in route}) == 4


# ----------------------------------------------------------------------- depo


def test_book_roundtrip(tmp_path):
    path = tmp_path / "spawns.json"
    book = SpawnBook(path)
    book.add(make_point())
    book.set_travel("felankor", "other", 120)
    book.record_kill("felankor", NOW)
    book.save()

    reloaded = SpawnBook(path).load()
    assert reloaded.get("felankor").kills == [NOW]
    assert reloaded.travel_seconds[("felankor", "other")] == 120
    assert reloaded.travel_seconds[("other", "felankor")] == 120


def test_book_rejects_duplicate_and_missing():
    book = SpawnBook("/tmp/unused.json")
    book.add(make_point())
    with pytest.raises(SpawnError):
        book.add(make_point())
    with pytest.raises(SpawnError, match="doğuş noktası yok"):
        book.get("yok")


def test_book_keeps_kill_history_bounded():
    point = make_point()
    for index in range(60):
        point.record_kill(NOW + index * 1500, keep=40)
    assert len(point.kills) == 40


def test_predictions_sorted_by_urgency(tmp_path):
    book = SpawnBook(tmp_path / "s.json")
    book.add(make_point(id="waiting", kills=[NOW]))
    book.add(make_point(id="open", kills=[NOW - 25 * 60]))
    book.add(make_point(id="unknown"))
    states = [p.point_id for p in book.predictions(NOW)]
    assert states[0] == "open"
    assert states[-1] == "unknown"


def test_invalid_point_rejected():
    with pytest.raises(SpawnError):
        SpawnPoint(id="x", name="X", respawn_min_s=600, respawn_max_s=300)
    with pytest.raises(SpawnError):
        SpawnPoint(id="", name="X")


def test_format_eta():
    assert format_eta(None) == "-"
    assert format_eta(45) == "45s"
    assert format_eta(125) == "2d 05s"
    assert format_eta(3700) == "1s 01d"


def test_route_start_point_has_no_travel_cost():
    here = predict(make_point(id="here", name="Here", kills=[NOW - 21 * 60]), NOW)
    route = plan_route([here], NOW, default_travel_s=300, start_at="here")
    assert route[0].travel_s == 0.0
