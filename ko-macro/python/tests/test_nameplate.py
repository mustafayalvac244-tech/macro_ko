"""Hedef adı tanıma testleri.

Gerçek oyun yazısı olmadığı için sentetik "yazı" desenleri kuruluyor:
bilinen bir desen öğretiliyor, sonra aynısı/başkası gösterilip motorun
doğru kararı vermesi bekleniyor.
"""

from __future__ import annotations

import pytest

from ko_macro.calibrate import FakeScreen
from ko_macro.nameplate import (
    GRID_HEIGHT,
    GRID_WIDTH,
    NameMatcher,
    NameRegion,
    fingerprint,
    is_blank,
    luminance,
    similarity,
)

DARK = (12, 12, 16)
TEXT = (230, 230, 90)      # KO'da mob adı sarımsı
TEXT_OTHER = (240, 120, 120)  # başka renk, aynı şekil

REGION = NameRegion(x0=10, y0=10, x1=137, y1=41)   # 128x32


def make_screen(pattern: str, color=TEXT, width=200, height=80) -> FakeScreen:
    """`pattern` satırlarındaki '#' işaretlerini bölgeye yazı olarak çizer.

    Desen bölgeye orantılı olarak yayılır, böylece küçük desenlerle
    okunabilir testler yazılabiliyor.
    """
    rows = [[DARK] * width for _ in range(height)]
    lines = pattern.strip("\n").split("\n")
    region_w = REGION.x1 - REGION.x0 + 1
    region_h = REGION.y1 - REGION.y0 + 1

    for row_index, line in enumerate(lines):
        y_start = REGION.y0 + row_index * region_h // len(lines)
        y_end = REGION.y0 + (row_index + 1) * region_h // len(lines)
        for col_index, char in enumerate(line):
            if char != "#":
                continue
            x_start = REGION.x0 + col_index * region_w // len(line)
            x_end = REGION.x0 + (col_index + 1) * region_w // len(line)
            for y in range(y_start, y_end):
                for x in range(x_start, x_end):
                    rows[y][x] = color
    return FakeScreen(rows)


HARPY = """
##..##..#...
#..#.#..#.#.
####.###.#..
#..#.#...#..
"""

KEKOIT = """
#..#.###.#..
#.#..#...#..
##...##..#..
#.#..#...###
"""


# ------------------------------------------------------------------ parmak izi


def test_luminance_orders_by_brightness():
    assert luminance((255, 255, 255)) > luminance((128, 128, 128)) > luminance((0, 0, 0))


def test_fingerprint_has_fixed_length():
    signature = fingerprint(make_screen(HARPY), REGION)
    assert len(signature) == GRID_WIDTH * GRID_HEIGHT


def test_fingerprint_is_stable_for_the_same_screen():
    first = fingerprint(make_screen(HARPY), REGION)
    second = fingerprint(make_screen(HARPY), REGION)
    assert first == second


def test_fingerprint_ignores_text_colour():
    """Mob adının rengi seviye farkına göre değişir; şekil aynı kalmalı."""
    yellow = fingerprint(make_screen(HARPY, color=TEXT), REGION)
    reddish = fingerprint(make_screen(HARPY, color=TEXT_OTHER), REGION)
    assert similarity(yellow, reddish) > 0.95


def test_different_names_give_different_fingerprints():
    harpy = fingerprint(make_screen(HARPY), REGION)
    kekoit = fingerprint(make_screen(KEKOIT), REGION)
    assert similarity(harpy, kekoit) < 0.85


def test_empty_region_is_blank():
    empty = fingerprint(FakeScreen([[DARK] * 200 for _ in range(80)]), REGION)
    assert is_blank(empty)


def test_written_region_is_not_blank():
    assert not is_blank(fingerprint(make_screen(HARPY), REGION))


# ------------------------------------------------------------------ benzerlik


def test_similarity_of_identical_is_one():
    assert similarity("1010", "1010") == 1.0


def test_similarity_of_opposite_is_zero():
    assert similarity("1111", "0000") == 0.0


def test_similarity_rejects_different_lengths():
    assert similarity("101", "1010") == 0.0


def test_similarity_of_empty_is_zero():
    assert similarity("", "") == 0.0


# ------------------------------------------------------------------ eşleştirme


def matcher(**kwargs) -> NameMatcher:
    signatures = kwargs.pop("signatures", None)
    if signatures is None:
        signatures = {"harpy": fingerprint(make_screen(HARPY), REGION)}
    return NameMatcher(region=REGION, signatures=signatures, **kwargs)


def test_accepts_the_learned_mob():
    assert matcher().accepts(make_screen(HARPY)) is True


def test_rejects_a_different_mob():
    assert matcher().accepts(make_screen(KEKOIT)) is False


def test_rejects_an_empty_nameplate():
    blank = FakeScreen([[DARK] * 200 for _ in range(80)])
    assert matcher().accepts(blank) is False


def test_accepts_everything_when_nothing_is_learned():
    # Filtre kapalı: imza yoksa her hedef geçer.
    empty_matcher = NameMatcher(region=REGION, signatures={})
    assert empty_matcher.accepts(make_screen(KEKOIT)) is True


def test_multiple_learned_mobs_are_all_accepted():
    both = matcher(
        signatures={
            "harpy": fingerprint(make_screen(HARPY), REGION),
            "kekoit": fingerprint(make_screen(KEKOIT), REGION),
        }
    )
    assert both.accepts(make_screen(HARPY)) is True
    assert both.accepts(make_screen(KEKOIT)) is True


def test_match_reports_the_name():
    found = matcher()
    assert found.match(make_screen(HARPY)) == "harpy"
    assert found.last_name == "harpy"
    assert found.last_score > 0.85


def test_low_threshold_lets_anything_through():
    loose = matcher(threshold=0.1)
    assert loose.accepts(make_screen(KEKOIT)) is True


def test_high_threshold_is_strict():
    strict = matcher(threshold=0.999)
    # Aynı desen bile renk değişince birebir tutmayabilir.
    assert strict.accepts(make_screen(HARPY)) is True
    assert strict.accepts(make_screen(KEKOIT)) is False


# --------------------------------------------------------------------- bölge


def test_region_rejects_inverted_bounds():
    with pytest.raises(ValueError, match="x1 > x0"):
        NameRegion(x0=100, y0=10, x1=50, y1=40)


def test_region_roundtrip():
    restored = NameRegion.from_dict(REGION.to_dict())
    assert restored == REGION
