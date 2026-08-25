"""Bar bulma testleri.

Gerçek oyun ekranı olmadığı için sentetik ekranlar kuruluyor: bilinen
koordinatlara bar çizip motorun onları geri bulmasını bekliyoruz.
"""

from __future__ import annotations

import pytest

from ko_macro.calibrate import (
    BarCandidate,
    FakeScreen,
    build_farm_patch,
    build_vitals_patch,
    find_bars,
    is_health_color,
    is_mana_color,
    suggest,
)

BACKGROUND = (24, 26, 30)
RED = (190, 34, 34)
BLUE = (40, 70, 200)


def make_screen(width: int, height: int, bars: list[dict]) -> FakeScreen:
    """Arka plan üstüne verilen barları çizer."""
    rows = [[BACKGROUND] * width for _ in range(height)]
    for bar in bars:
        for y in range(bar["y"], bar["y"] + bar.get("thickness", 6)):
            for x in range(bar["x0"], bar["x1"] + 1):
                rows[y][x] = bar["color"]
    return FakeScreen(rows)


# -------------------------------------------------------------------- renkler


def test_health_color_detection():
    assert is_health_color(RED)
    assert not is_health_color(BLUE)
    assert not is_health_color(BACKGROUND)


def test_mana_color_detection():
    assert is_mana_color(BLUE)
    assert not is_mana_color(RED)


def test_dark_colors_are_not_bars():
    # Boş barın koyu zemini bar sayılmamalı.
    assert not is_health_color((40, 10, 10))
    assert not is_mana_color((10, 10, 40))


# --------------------------------------------------------------------- bulma


def test_finds_a_single_bar():
    screen = make_screen(800, 200, [{"x0": 40, "x1": 190, "y": 40, "color": RED}])
    bars = find_bars(screen)

    assert len(bars) == 1
    assert bars[0].kind == "can"
    assert bars[0].x0 == 40
    assert bars[0].x1 == 190


def test_merges_thick_bar_into_one_candidate():
    # 10 piksel kalınlığındaki bar 10 ayrı aday değil, tek aday olmalı.
    screen = make_screen(800, 200, [{"x0": 40, "x1": 190, "y": 40, "color": RED,
                                     "thickness": 10}])
    bars = find_bars(screen)

    assert len(bars) == 1
    assert bars[0].height == 10
    assert bars[0].y == 44          # dikey orta


def test_ignores_narrow_runs():
    screen = make_screen(800, 200, [{"x0": 10, "x1": 25, "y": 40, "color": RED}])
    assert find_bars(screen) == []


def test_finds_health_and_mana_separately():
    screen = make_screen(800, 200, [
        {"x0": 40, "x1": 190, "y": 40, "color": RED},
        {"x0": 40, "x1": 190, "y": 54, "color": BLUE},
    ])
    bars = find_bars(screen)
    assert {bar.kind for bar in bars} == {"can", "mana"}


def test_widest_bar_comes_first():
    screen = make_screen(800, 200, [
        {"x0": 40, "x1": 140, "y": 40, "color": RED},
        {"x0": 300, "x1": 600, "y": 90, "color": RED},
    ])
    bars = find_bars(screen)
    assert bars[0].width > bars[1].width


def test_reports_average_color():
    screen = make_screen(800, 200, [{"x0": 40, "x1": 190, "y": 40, "color": RED}])
    assert find_bars(screen)[0].color == RED


# ------------------------------------------------------------------- tahmin


def ko_like_screen() -> FakeScreen:
    """Knight Online yerleşimine benzer ekran: sol üstte can+mana, üst ortada hedef."""
    return make_screen(1920, 1080, [
        {"x0": 40, "x1": 190, "y": 40, "color": RED},     # oyuncu canı
        {"x0": 40, "x1": 190, "y": 54, "color": BLUE},    # oyuncu manası
        {"x0": 860, "x1": 1060, "y": 60, "color": RED},   # hedef canı
    ])


def test_suggestion_picks_leftmost_red_as_player_hp():
    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    assert guess.hp is not None and guess.hp.x0 == 40


def test_suggestion_picks_centre_red_as_target():
    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    assert guess.target is not None and guess.target.x0 == 860


def test_suggestion_picks_nearest_blue_as_mana():
    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    assert guess.mp is not None and guess.mp.y == pytest.approx(56, abs=4)


def test_no_target_when_nothing_is_centred():
    screen = make_screen(1920, 1080, [
        {"x0": 40, "x1": 190, "y": 40, "color": RED},
        {"x0": 1800, "x1": 1900, "y": 40, "color": RED},   # kenarda, hedef değil
    ])
    guess = suggest(find_bars(screen), screen.width)
    assert guess.target is None


def test_incomplete_when_no_red_bar():
    screen = make_screen(1920, 1080, [{"x0": 40, "x1": 190, "y": 40, "color": BLUE}])
    guess = suggest(find_bars(screen), screen.width)
    assert guess.complete is False
    assert guess.hp is None


# --------------------------------------------------------------------- yamalar


def test_vitals_patch_shape():
    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    patch = build_vitals_patch(guess)

    assert patch["enabled"] is True
    assert patch["hp"]["x0"] == 40
    assert patch["hp"]["color"] == list(RED)
    assert "mp" in patch


def test_farm_patch_carries_target_bar():
    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    assert build_farm_patch(guess)["target_bar"]["x0"] == 860


def test_farm_patch_empty_without_target():
    screen = make_screen(800, 600, [{"x0": 40, "x1": 190, "y": 40, "color": RED}])
    guess = suggest(find_bars(screen), screen.width)
    assert build_farm_patch(guess) == {}


def test_patch_regions_load_as_config():
    from ko_macro.config import BarRegion

    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    # Üretilen tanım config tarafından kabul edilmeli.
    region = BarRegion.from_dict(build_vitals_patch(guess)["hp"])
    assert region.x1 > region.x0


def test_candidate_describe_mentions_side():
    bar = BarCandidate(kind="can", x0=40, x1=190, y=40, top=38, bottom=42, color=RED)
    assert "sol" in bar.describe(1920)


# ----------------------------------------------------- config'e yazma turu


def test_calibration_writes_a_loadable_config(tmp_path):
    """Bulunan koordinatlar config'e yazılınca dosya hâlâ yüklenebilmeli."""
    from ko_macro.cli import _write_config_patch
    from ko_macro.config import load_config

    path = tmp_path / "config.yaml"
    path.write_text("profile: archer\nvitals:\n  enabled: false\n", encoding="utf-8")

    screen = ko_like_screen()
    guess = suggest(find_bars(screen), screen.width)
    backup = _write_config_patch(
        path,
        {"vitals": build_vitals_patch(guess), "farm": build_farm_patch(guess)},
    )

    config = load_config(path)
    assert config.vitals.enabled is True
    assert config.vitals.hp is not None and config.vitals.hp.x0 == 40
    assert config.farm.target_bar is not None and config.farm.target_bar.x0 == 860
    # Profilden gelenler korunmuş olmalı.
    assert config.stance_key == "z"
    assert backup.is_file()


def test_write_keeps_a_backup_of_the_original(tmp_path):
    from ko_macro.cli import _write_config_patch

    path = tmp_path / "config.yaml"
    original = "profile: archer\n# elle yazdigim not\n"
    path.write_text(original, encoding="utf-8")

    backup = _write_config_patch(path, {"vitals": {"enabled": True}})
    assert backup.read_text(encoding="utf-8") == original
