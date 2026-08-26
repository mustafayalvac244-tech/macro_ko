"""Ekranda mob isim etiketi bulma testleri.

Gerçek oyun kadrajı olmadığı için bilinen yerlere "isim yazısı" çizilip
motorun onları geri bulması bekleniyor.
"""

from __future__ import annotations

import pytest

from ko_macro.calibrate import FakeScreen
from ko_macro.mobscan import (
    ExcludedArea,
    Nameplate,
    ScanSettings,
    find_nameplates,
    nearest_to_center,
)

BACKGROUND = (30, 60, 30)      # çimen
PLATE = (235, 235, 130)        # mob adı sarısı
OTHER = (60, 90, 240)          # başka renk yazı


def make_screen(width: int, height: int, labels: list[dict]) -> FakeScreen:
    """Her etiketi, harf aralıkları olan kısa bir yazı şeridi olarak çizer."""
    rows = [[BACKGROUND] * width for _ in range(height)]
    for label in labels:
        color = label.get("color", PLATE)
        thickness = label.get("thickness", 8)
        x = label["x0"]
        # 5 "harf", aralarında 3 piksel boşluk (LETTER_GAP altında).
        for _ in range(label.get("letters", 5)):
            for dy in range(thickness):
                for dx in range(label.get("letter_width", 6)):
                    rows[label["y0"] + dy][x + dx] = color
            x += label.get("letter_width", 6) + 3
    return FakeScreen(rows)


# ------------------------------------------------------------------- bulma


def test_finds_a_single_nameplate():
    screen = make_screen(800, 400, [{"x0": 300, "y0": 150}])
    plates = find_nameplates(screen)

    assert len(plates) == 1
    assert plates[0].x0 == 300
    assert plates[0].height == 8


def test_letters_merge_into_one_plate():
    """Harfler arası boşluk etiketi bölmemeli."""
    screen = make_screen(800, 400, [{"x0": 300, "y0": 150, "letters": 6}])
    plates = find_nameplates(screen)
    assert len(plates) == 1
    assert plates[0].width > 40


def test_finds_several_mobs():
    screen = make_screen(1000, 500, [
        {"x0": 100, "y0": 120},
        {"x0": 500, "y0": 200},
        {"x0": 800, "y0": 300, "letters": 3},
    ])
    assert len(find_nameplates(screen)) == 3


def test_widest_plate_first():
    screen = make_screen(1000, 500, [
        {"x0": 100, "y0": 120, "letters": 3},
        {"x0": 500, "y0": 200, "letters": 8},
    ])
    plates = find_nameplates(screen)
    assert plates[0].width > plates[1].width


def test_ignores_other_coloured_text():
    screen = make_screen(800, 400, [
        {"x0": 300, "y0": 150},
        {"x0": 300, "y0": 250, "color": OTHER},
    ])
    assert len(find_nameplates(screen)) == 1


def test_ignores_too_small_marks():
    # Tek harflik leke etiket sayılmamalı.
    screen = make_screen(800, 400, [{"x0": 300, "y0": 150, "letters": 1}])
    assert find_nameplates(screen) == []


def test_ignores_too_tall_blocks():
    # Kalın bir renk bloğu (arayüz paneli) etiket değildir.
    screen = make_screen(800, 400, [{"x0": 300, "y0": 100, "thickness": 60}])
    assert find_nameplates(screen) == []


def test_excluded_area_is_not_scanned():
    """Sohbet kutusundaki yazı mob sanılmamalı."""
    screen = make_screen(800, 400, [
        {"x0": 100, "y0": 350},     # sohbet bölgesi
        {"x0": 400, "y0": 150},     # gerçek mob
    ])
    settings = ScanSettings(excluded=[ExcludedArea(x0=0, y0=320, x1=799, y1=399)])
    plates = find_nameplates(screen, settings)

    assert len(plates) == 1
    assert plates[0].y0 == 150


def test_dark_pixels_are_not_text():
    dark_plate = (40, 40, 20)      # doğru renk ama çok karanlık
    screen = make_screen(800, 400, [{"x0": 300, "y0": 150, "color": dark_plate}])
    assert find_nameplates(screen) == []


def test_empty_screen_finds_nothing():
    assert find_nameplates(FakeScreen([[BACKGROUND] * 400 for _ in range(200)])) == []


# ------------------------------------------------------------------- seçim


def test_nearest_to_centre_is_the_one_you_face():
    screen = make_screen(1000, 600, [
        {"x0": 60, "y0": 100},      # kenarda
        {"x0": 470, "y0": 290},     # ortada
    ])
    plates = find_nameplates(screen)
    chosen = nearest_to_center(plates, screen)
    assert chosen is not None and chosen.x0 == 470


def test_nearest_to_centre_of_nothing_is_none():
    screen = FakeScreen([[BACKGROUND] * 100 for _ in range(100)])
    assert nearest_to_center([], screen) is None


def test_click_point_is_below_the_label():
    """Etikete değil, altındaki gövdeye tıklanmalı."""
    plate = Nameplate(x0=100, y0=50, x1=180, y1=58)
    x, y = plate.click_point
    assert x == 140
    assert y > plate.y1


def test_distance_is_measured_from_the_centre():
    plate = Nameplate(x0=100, y0=100, x1=100, y1=100)
    assert plate.distance_to(100, 100) == 0.0
    assert plate.distance_to(103, 104) == pytest.approx(5.0)


# ------------------------------------------------------------------ ayarlar


def test_settings_roundtrip():
    settings = ScanSettings(
        color=(1, 2, 3), tolerance=44,
        excluded=[ExcludedArea(1, 2, 3, 4)],
    )
    restored = ScanSettings.from_dict(settings.to_dict())
    assert restored.color == (1, 2, 3)
    assert restored.tolerance == 44
    assert restored.excluded[0].x1 == 3


def test_settings_reject_bad_colour():
    with pytest.raises(ValueError, match="3 elemanlı"):
        ScanSettings.from_dict({"color": [1, 2]})


def test_settings_reject_inverted_size_bounds():
    with pytest.raises(ValueError, match="min_width"):
        ScanSettings.from_dict({"min_width": 100, "max_width": 10})
