"""Ekrandan rakam okuma testleri.

Gerçek oyun yazısı olmadığı için 7 parçalı gösterge biçiminde sentetik
rakamlar çiziliyor: öğretiliyor, sonra okutuluyor.
"""

from __future__ import annotations

import pytest

from ko_macro.calibrate import FakeScreen
from ko_macro.ocr import (
    DigitReader,
    OcrError,
    TextRegion,
    glyph_signature,
    read_glyphs,
    segment_glyphs,
)

DARK = (10, 10, 14)
INK = (240, 240, 240)

#: Her rakam 3 sütun x 5 satırlık bir desen.
DIGIT_PATTERNS = {
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": ["..#", "..#", "..#", "..#", "..#"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", "..#", "..#"],
    "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"],
}

CELL = 3          # her desen hücresi kaç piksel
SPACING = 4       # rakamlar arası boşluk (piksel)
MARGIN = 5


def draw(text: str, width: int = 400, height: int = 40) -> tuple[FakeScreen, TextRegion]:
    """Verilen diziyi çizer ve tam kapsayan bölgeyi döndürür.

    Boşluk karakteri geniş bir aralık bırakır — oyunun "512 378" biçiminde
    yazdığı durumu taklit eder.
    """
    rows = [[DARK] * width for _ in range(height)]
    x = MARGIN
    for char in text:
        if char == " ":
            x += 3 * CELL + SPACING      # geniş boşluk
            continue
        pattern = DIGIT_PATTERNS[char]
        for row_index, line in enumerate(pattern):
            for col_index, mark in enumerate(line):
                if mark != "#":
                    continue
                for dy in range(CELL):
                    for dx in range(CELL):
                        rows[MARGIN + row_index * CELL + dy][x + col_index * CELL + dx] = INK
        x += 3 * CELL + SPACING

    region = TextRegion(
        x0=MARGIN - 2, y0=MARGIN - 2,
        x1=x - SPACING + 1, y1=MARGIN + 5 * CELL + 1,
    )
    return FakeScreen(rows), region


# --------------------------------------------------------------------- bölme


def test_segments_each_digit():
    screen, region = draw("123")
    from ko_macro.ocr import _ink_map

    boxes = segment_glyphs(_ink_map(screen, region))
    assert len(boxes) == 3


def test_segments_a_single_digit():
    screen, region = draw("7")
    from ko_macro.ocr import _ink_map

    assert len(segment_glyphs(_ink_map(screen, region))) == 1


def test_empty_region_has_no_glyphs():
    blank = FakeScreen([[DARK] * 100 for _ in range(30)])
    region = TextRegion(x0=0, y0=0, x1=99, y1=29)
    assert read_glyphs(blank, region) == []


def test_signature_has_fixed_length():
    from ko_macro.ocr import GLYPH_HEIGHT, GLYPH_WIDTH, _ink_map

    screen, region = draw("5")
    ink = _ink_map(screen, region)
    x0, x1 = segment_glyphs(ink)[0]
    assert len(glyph_signature(ink, x0, x1)) == GLYPH_WIDTH * GLYPH_HEIGHT


# ------------------------------------------------------------------ öğrenme


def test_learns_every_digit_shown():
    screen, region = draw("0123456789")
    reader = DigitReader()
    learned = reader.learn(screen, region, "0123456789")

    assert sorted(learned) == list("0123456789")
    assert reader.complete is True
    assert reader.missing_digits == []


def test_learning_accumulates_across_runs():
    reader = DigitReader()
    first_screen, first_region = draw("012")
    reader.learn(first_screen, first_region, "012")
    assert set(reader.missing_digits) == set("3456789")

    second_screen, second_region = draw("345")
    reader.learn(second_screen, second_region, "345")
    assert set(reader.missing_digits) == set("6789")


def test_learn_rejects_mismatched_count():
    screen, region = draw("123")
    reader = DigitReader()
    with pytest.raises(OcrError, match="karakter var"):
        reader.learn(screen, region, "12")


def test_learn_rejects_text_without_digits():
    screen, region = draw("123")
    reader = DigitReader()
    with pytest.raises(OcrError, match="rakam içeren"):
        reader.learn(screen, region, "abc")


def test_learn_ignores_spaces_in_the_typed_value():
    screen, region = draw("512")
    reader = DigitReader()
    reader.learn(screen, region, " 512 ")
    assert reader.read_number(screen, region) == 512


# -------------------------------------------------------------------- okuma


def trained() -> tuple[DigitReader, TextRegion]:
    screen, region = draw("0123456789")
    reader = DigitReader()
    reader.learn(screen, region, "0123456789")
    return reader, region


def test_reads_back_what_it_learned():
    reader, region = trained()
    screen, _ = draw("0123456789")
    assert reader.read_text(screen, region) == "0123456789"


def test_reads_a_new_number():
    reader, _ = trained()
    screen, region = draw("512378")
    assert reader.read_number(screen, region) == 512378


def test_reads_coordinates_from_two_regions():
    """X ve Y ayrı kutulardan okunur - bölme sezgiseli yok."""
    reader, _ = trained()
    screen_x, region_x = draw("512", height=80)
    screen_y, region_y = draw("378", height=80)

    # İki kutuyu tek ekranda birleştir: Y kutusunu alt satıra koy.
    rows = [list(row) for row in screen_x.rows]
    offset = 30
    for y, row in enumerate(screen_y.rows):
        for x, pixel in enumerate(row):
            if pixel == INK:
                rows[y + offset][x] = INK
    combined = FakeScreen(rows)
    shifted_y = TextRegion(
        x0=region_y.x0, y0=region_y.y0 + offset,
        x1=region_y.x1, y1=region_y.y1 + offset,
    )

    assert reader.read_coordinates(combined, region_x, shifted_y) == (512, 378)


def test_reading_without_training_fails_clearly():
    screen, region = draw("123")
    reader = DigitReader()
    with pytest.raises(OcrError, match="hiç rakam öğretilmemiş"):
        reader.read_text(screen, region)


def test_unknown_glyph_becomes_question_mark():
    reader, _ = trained()
    partial = DigitReader(glyphs={"1": reader.glyphs["1"]})
    screen, region = draw("8")
    assert partial.read_text(screen, region) == "?"


def test_partial_read_refuses_to_guess():
    reader, _ = trained()
    partial = DigitReader(glyphs={"1": reader.glyphs["1"]})
    screen, region = draw("18")
    with pytest.raises(OcrError, match="tam okunamadı"):
        partial.read_number(screen, region)


def test_classify_returns_none_below_threshold():
    reader, _ = trained()
    reader.threshold = 0.999
    assert reader.classify("0" * 60) is None


# --------------------------------------------------------------------- bölge


def test_region_rejects_inverted_bounds():
    with pytest.raises(ValueError, match="x1 > x0"):
        TextRegion(x0=100, y0=0, x1=10, y1=20)


def test_region_roundtrip():
    region = TextRegion(x0=1, y0=2, x1=30, y1=20, ink_threshold=150)
    assert TextRegion.from_dict(region.to_dict()) == region
