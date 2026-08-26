"""Savaş kaydı okuma testleri.

Gerçek oyun yazısı yok, o yüzden bilinen desenlerle "satırlar" çiziliyor.
Önemli olan: kalıp satırın neresinde olursa olsun bulunmalı, aynı olay iki
kez sayılmamalı, benzemeyen satır olay üretmemeli.
"""

from __future__ import annotations

import pytest

from ko_macro.calibrate import FakeScreen
from ko_macro.combatlog import (
    CombatLogWatcher,
    LogRegion,
    Phrase,
    column_profile,
    contains_phrase,
    profile_similarity,
    trim_profile,
)

DARK = (8, 8, 12)
INK = (220, 220, 210)

REGION = LogRegion(x0=10, y0=10, x1=209, y1=79, line_height=14)

#: Kısa "kelime" desenleri: her karakter 4 piksel geniş.
WORDS = {
    "received": "##.#.##.#",
    "earned": "#.##..#",
    "damage": "###..##.##",
    "other": ".#.#.#.#.#.#",
}


def draw_lines(lines: list[tuple[int, str]], width: int = 260, height: int = 100):
    """`(satır_index, metin)` çiftlerini ekrana çizer.

    Metin ``|`` ile ayrılmış kelimelerden oluşur; her kelime WORDS'ten alınır
    ve aralarına boşluk konur. Böylece kalıbın satır içindeki yeri değişir.
    """
    rows = [[DARK] * width for _ in range(height)]
    for line_index, text in lines:
        top, bottom = REGION.line_bounds(line_index)
        x = REGION.x0 + 2
        for word in text.split("|"):
            pattern = WORDS[word]
            for mark in pattern:
                if mark == "#":
                    for dy in range(top + 2, min(top + 10, bottom + 1)):
                        for dx in range(4):
                            if x + dx <= REGION.x1:
                                rows[dy][x + dx] = INK
                x += 4
            x += 8   # kelime arası boşluk
    return FakeScreen(rows)


def watcher(**kwargs) -> CombatLogWatcher:
    return CombatLogWatcher(region=REGION, **kwargs)


def learned(name: str, word: str) -> Phrase:
    """Tek bir kelimeyi kalıp olarak öğrenir."""
    screen = draw_lines([(0, word)])
    return watcher().learn(screen, name, 0)


# ------------------------------------------------------------------- profil


def test_profile_of_an_empty_line_is_empty():
    screen = draw_lines([])
    top, bottom = REGION.line_bounds(0)
    assert trim_profile(column_profile(screen, REGION, top, bottom)) == []


def test_profile_has_ink_where_text_is():
    screen = draw_lines([(0, "received")])
    top, bottom = REGION.line_bounds(0)
    assert sum(column_profile(screen, REGION, top, bottom)) > 0


def test_identical_profiles_match():
    assert profile_similarity([1, 2, 3], [1, 2, 3]) == 1.0


def test_opposite_profiles_do_not_match():
    assert profile_similarity([5, 5, 5], [0, 0, 0]) == 0.0


def test_different_lengths_never_match():
    assert profile_similarity([1, 2], [1, 2, 3]) == 0.0


# ----------------------------------------------------------- kalıp arama


def test_phrase_is_found_at_the_start_of_a_line():
    phrase = learned("received", "received")
    screen = draw_lines([(0, "received|damage")])
    top, bottom = REGION.line_bounds(0)
    line = trim_profile(column_profile(screen, REGION, top, bottom))

    assert contains_phrase(line, phrase.profile) is True


def test_phrase_is_found_in_the_middle_of_a_line():
    """Mob adı satır başında olduğu için kalıbın yeri kayar."""
    phrase = learned("received", "received")
    screen = draw_lines([(0, "other|received|damage")])
    top, bottom = REGION.line_bounds(0)
    line = trim_profile(column_profile(screen, REGION, top, bottom))

    assert contains_phrase(line, phrase.profile) is True


def test_absent_phrase_is_not_found():
    phrase = learned("earned", "earned")
    screen = draw_lines([(0, "other|other")])
    top, bottom = REGION.line_bounds(0)
    line = trim_profile(column_profile(screen, REGION, top, bottom))

    assert contains_phrase(line, phrase.profile) is False


def test_a_phrase_longer_than_the_line_is_not_found():
    assert contains_phrase([1, 2], [1, 2, 3]) is False


# ------------------------------------------------------------------- olaylar


def test_new_line_produces_an_event():
    phrase = learned("kill", "earned")
    log = watcher(phrases=[phrase])

    events = log.read(draw_lines([(0, "other|earned")]))
    assert [event.phrase for event in events] == ["kill"]


def test_the_same_line_is_not_counted_twice():
    """Kayıt kaydıkça aynı satır tekrar görünür; olay bir kez sayılmalı."""
    phrase = learned("kill", "earned")
    log = watcher(phrases=[phrase])
    screen = draw_lines([(0, "other|earned")])

    assert len(log.read(screen)) == 1
    assert log.read(screen) == []
    assert log.counts["kill"] == 1


def test_a_second_different_kill_line_counts_again():
    phrase = learned("kill", "earned")
    log = watcher(phrases=[phrase])

    log.read(draw_lines([(0, "other|earned")]))
    # Farklı bir satır (başka mob adı) - yeni olay.
    events = log.read(draw_lines([(1, "damage|earned")]))
    assert [event.phrase for event in events] == ["kill"]
    assert log.counts["kill"] == 2


def test_unrelated_lines_produce_nothing():
    phrase = learned("kill", "earned")
    log = watcher(phrases=[phrase])
    assert log.read(draw_lines([(0, "other|other")])) == []


def test_several_phrases_are_matched_independently():
    log = watcher(phrases=[learned("kill", "earned"), learned("hit", "received")])

    events = log.read(draw_lines([(0, "other|earned"), (1, "other|received")]))
    assert sorted(event.phrase for event in events) == ["hit", "kill"]


def test_poll_interval_is_respected():
    log = watcher(phrases=[learned("kill", "earned")], poll_ms=500)
    screen = draw_lines([(0, "other|earned")])

    assert log.tick(lambda box: screen, now=0.0) != []
    assert log.tick(lambda box: screen, now=0.1) == []      # henüz zamanı değil


def test_screen_failure_is_swallowed():
    def broken(box):
        raise RuntimeError("ekran alınamadı")

    log = watcher(phrases=[learned("kill", "earned")])
    assert log.tick(broken, now=10.0) == []


def test_no_phrases_means_no_work():
    log = watcher()
    assert log.tick(lambda box: draw_lines([(0, "other|earned")]), now=10.0) == []


# -------------------------------------------------------------------- öğrenme


def test_learning_replaces_a_phrase_of_the_same_name():
    log = watcher()
    log.learn(draw_lines([(0, "earned")]), "kill", 0)
    log.learn(draw_lines([(0, "received")]), "kill", 0)
    assert len(log.phrases) == 1


def test_learning_an_empty_line_fails():
    log = watcher()
    with pytest.raises(ValueError, match="boş görünüyor"):
        log.learn(draw_lines([]), "kill", 0)


def test_phrase_roundtrip():
    phrase = learned("kill", "earned")
    restored = Phrase.from_dict(phrase.to_dict())
    assert restored.name == "kill"
    assert restored.profile == phrase.profile


# -------------------------------------------------------------------- bölge


def test_region_splits_into_lines():
    assert REGION.line_count == 5
    assert REGION.line_bounds(0)[0] == REGION.y0
    assert REGION.line_bounds(1)[0] == REGION.y0 + REGION.line_height


def test_region_rejects_bad_bounds():
    with pytest.raises(ValueError, match="x1 > x0"):
        LogRegion(x0=100, y0=0, x1=10, y1=50)
    with pytest.raises(ValueError, match="line_height"):
        LogRegion(x0=0, y0=0, x1=100, y1=50, line_height=1)
