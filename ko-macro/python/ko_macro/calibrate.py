"""Can/mana/hedef barlarını ekranda kendiliğinden bulur.

Elle Paint'te koordinat ölçmek yerine ekranı tarar: bar'lar, arka plandan
belirgin şekilde ayrılan **yatay renk şeritleri**dir. Yeterince uzun ve
doygun renkli kesintisiz diziler aday olarak toplanır, üst üste gelen
satırlar tek bara birleştirilir.

Kusursuz değil ve öyleymiş gibi de davranmıyor: arayüz teması, çözünürlük ve
ekrandaki başka kırmızı/mavi öğeler adayları etkiler. Bu yüzden komut bulduğu
adayları listeler, sen onaylarsın; ``vitals`` komutu da sonucu doğrular.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Protocol

#: Bir şeridi "bar" saymak için gereken en az genişlik (piksel).
MIN_BAR_WIDTH = 50

#: Barlar birkaç piksel kalınlığındadır; bu kadar komşu satır tek bar sayılır.
MAX_BAR_HEIGHT = 40

#: Aynı bara ait satırların kenarları bu kadar kayabilir.
EDGE_TOLERANCE = 6


class Screen(Protocol):
    """Ekran görüntüsü kaynağı."""

    width: int
    height: int

    def row(self, y: int) -> list[tuple[int, int, int]]:
        """``y`` satırındaki tüm pikseller, soldan sağa RGB olarak."""


class FakeScreen:
    """Test için: satırları elle verilen ekran."""

    def __init__(self, rows: list[list[tuple[int, int, int]]]) -> None:
        self.rows = rows
        self.height = len(rows)
        self.width = len(rows[0]) if rows else 0

    def row(self, y: int) -> list[tuple[int, int, int]]:
        return self.rows[y]


class OffsetRow:
    """Sadece bir aralığı tutan, ama mutlak koordinatla indislenen satır.

    Küçük bir bölgeyi yakalayıp okurken bile çağıranlar ekran koordinatı
    kullanıyor. Bu sarmalayıcı, tam genişlikte liste ayırmadan o koordinatları
    karşılar; aralık dışı istekler siyah döner.
    """

    __slots__ = ("_pixels", "_x0")

    def __init__(self, pixels: list[tuple[int, int, int]], x0: int) -> None:
        self._pixels = pixels
        self._x0 = x0

    def __getitem__(self, x: int) -> tuple[int, int, int]:
        index = x - self._x0
        if 0 <= index < len(self._pixels):
            return self._pixels[index]
        return (0, 0, 0)

    def __len__(self) -> int:
        # Çağıranlar `min(region.x1 + 1, len(row))` yapıyor; sağ sınır doğru
        # kalsın diye uzunluk mutlak koordinat cinsinden veriliyor.
        return self._x0 + len(self._pixels)


class CroppedScreen:
    """Bir ekranın yalnız verilen kutusunu sunan görünüm.

    Boyutlar kaynak ekranınkiyle aynı kalır, böylece mutlak koordinatlarla
    yazılmış bölge tanımları değişmeden çalışır.
    """

    def __init__(self, source: Screen, box: tuple[int, int, int, int]) -> None:
        x0, y0, x1, y1 = box
        self.width = source.width
        self.height = source.height
        self._x0 = max(0, x0)
        self._y0 = max(0, y0)
        self._rows = [
            source.row(y)[self._x0 : x1 + 1]
            for y in range(self._y0, min(y1 + 1, source.height))
        ]

    def row(self, y: int) -> OffsetRow:
        index = y - self._y0
        if 0 <= index < len(self._rows):
            return OffsetRow(self._rows[index], self._x0)
        return OffsetRow([], self._x0)


class MSSScreen:
    """Gerçek ekranı yakalayıp satır satır sunar.

    ``box`` verilirse sadece o dikdörtgen yakalanır. Yakalama işin pahalı
    kısmı olduğu için, küçük bir alana bakacaksak (hedef adı, koordinat)
    tüm ekranı almak boşuna gecikme demek.
    """

    def __init__(
        self, monitor: int = 1, box: tuple[int, int, int, int] | None = None
    ) -> None:
        try:
            import mss
        except ImportError as exc:  # pragma: no cover - ortama bağlı
            raise RuntimeError("mss kurulu değil: pip install mss") from exc

        with mss.mss() as grabber:
            area = grabber.monitors[monitor]
            if box is None:
                shot = grabber.grab(area)
                self._x0, self._y0 = 0, 0
                self.width, self.height = shot.width, shot.height
            else:
                x0, y0, x1, y1 = box
                x0, y0 = max(0, x0), max(0, y0)
                shot = grabber.grab(
                    {"left": x0, "top": y0,
                     "width": max(1, x1 - x0 + 1), "height": max(1, y1 - y0 + 1)}
                )
                self._x0, self._y0 = x0, y0
                # Bölge kırpılmış olsa da boyutlar tam ekranı bildirir:
                # bölge tanımları mutlak koordinatla yazılıyor.
                self.width = area["width"]
                self.height = area["height"]

        self._shot_width = shot.width
        self._shot_height = shot.height
        self._raw = bytes(shot.raw)  # BGRA

    def row(self, y: int) -> OffsetRow:
        index = y - self._y0
        if not 0 <= index < self._shot_height:
            return OffsetRow([], self._x0)
        start = index * self._shot_width * 4
        raw = self._raw
        pixels = [
            (raw[i + 2], raw[i + 1], raw[i])
            for i in range(start, start + self._shot_width * 4, 4)
        ]
        return OffsetRow(pixels, self._x0)


# ------------------------------------------------------------------ renk testi


def is_health_color(pixel: tuple[int, int, int]) -> bool:
    """Doygun kırmızı (can barı / hedef barı)."""
    red, green, blue = pixel
    return red > 80 and red > green * 1.8 and red > blue * 1.8


def is_mana_color(pixel: tuple[int, int, int]) -> bool:
    """Doygun mavi (mana barı)."""
    red, green, blue = pixel
    return blue > 80 and blue > red * 1.6 and blue > green * 1.3


COLOR_TESTS = {"can": is_health_color, "mana": is_mana_color}


# --------------------------------------------------------------------- adaylar


@dataclass
class BarCandidate:
    """Ekranda bulunan bir bar."""

    kind: str  # can | mana
    x0: int
    x1: int
    y: int
    top: int
    bottom: int
    color: tuple[int, int, int]

    @property
    def width(self) -> int:
        return self.x1 - self.x0 + 1

    @property
    def height(self) -> int:
        return self.bottom - self.top + 1

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2.0

    def to_region(self) -> dict[str, object]:
        """config.yaml'a yazılacak bar tanımı."""
        return {
            "x0": self.x0,
            "x1": self.x1,
            "y": self.y,
            "color": list(self.color),
            "tolerance": 60,
        }

    def describe(self, screen_width: int) -> str:
        side = "sol" if self.center_x < screen_width / 3 else (
            "orta" if self.center_x < screen_width * 2 / 3 else "sağ"
        )
        return (
            f"{self.kind:<5} x {self.x0}-{self.x1} (genişlik {self.width}), "
            f"y {self.y}, kalınlık {self.height}, renk {self.color}, {side} taraf"
        )


def _runs(row: list[tuple[int, int, int]], test) -> Iterable[tuple[int, int]]:
    """Satırdaki kesintisiz eşleşen dizileri ``(başlangıç, bitiş)`` verir."""
    start: int | None = None
    for index, pixel in enumerate(row):
        if test(pixel):
            if start is None:
                start = index
        elif start is not None:
            yield start, index - 1
            start = None
    if start is not None:
        yield start, len(row) - 1


def _dominant_color(row: list[tuple[int, int, int]], x0: int, x1: int) -> tuple[int, int, int]:
    """Şeridin ortalama rengi — tek piksel yerine, gölgelendirmeye dayanıklı."""
    span = row[x0 : x1 + 1]
    count = len(span) or 1
    return (
        sum(p[0] for p in span) // count,
        sum(p[1] for p in span) // count,
        sum(p[2] for p in span) // count,
    )


def find_bars(
    screen: Screen,
    min_width: int = MIN_BAR_WIDTH,
    row_step: int = 1,
) -> list[BarCandidate]:
    """Ekrandaki bar adaylarını bulur, en geniş olan başta olacak şekilde.

    Bar birden çok satır kalınlığında olduğu için üst üste gelen şeritler tek
    adaya birleştirilir ve dikey ortası ``y`` olarak verilir.
    """
    open_bars: list[dict] = []
    finished: list[dict] = []

    for y in range(0, screen.height, max(1, row_step)):
        row = screen.row(y)
        seen: list[dict] = []

        for kind, test in COLOR_TESTS.items():
            for x0, x1 in _runs(row, test):
                if x1 - x0 + 1 < min_width:
                    continue
                seen.append(
                    {
                        "kind": kind, "x0": x0, "x1": x1,
                        "top": y, "bottom": y,
                        "color": _dominant_color(row, x0, x1),
                    }
                )

        still_open: list[dict] = []
        for current in seen:
            # Bir önceki satırdaki aynı bara denk geliyor mu?
            for previous in open_bars:
                if (
                    previous["kind"] == current["kind"]
                    and abs(previous["x0"] - current["x0"]) <= EDGE_TOLERANCE
                    and abs(previous["x1"] - current["x1"]) <= EDGE_TOLERANCE
                    and y - previous["bottom"] <= max(2, row_step)
                ):
                    previous["bottom"] = y
                    previous["x0"] = min(previous["x0"], current["x0"])
                    previous["x1"] = max(previous["x1"], current["x1"])
                    still_open.append(previous)
                    break
            else:
                still_open.append(current)

        for previous in open_bars:
            if previous not in still_open:
                finished.append(previous)
        open_bars = still_open

    finished.extend(open_bars)

    candidates = [
        BarCandidate(
            kind=bar["kind"],
            x0=bar["x0"],
            x1=bar["x1"],
            y=(bar["top"] + bar["bottom"]) // 2,
            top=bar["top"],
            bottom=bar["bottom"],
            color=bar["color"],
        )
        for bar in finished
        if bar["bottom"] - bar["top"] + 1 <= MAX_BAR_HEIGHT
    ]
    candidates.sort(key=lambda bar: bar.width, reverse=True)
    return candidates


# ----------------------------------------------------------------- eşleştirme


@dataclass
class Suggestion:
    """Adaylardan çıkarılan tahmin."""

    hp: BarCandidate | None = None
    mp: BarCandidate | None = None
    target: BarCandidate | None = None

    @property
    def complete(self) -> bool:
        return self.hp is not None


def suggest(candidates: list[BarCandidate], screen_width: int) -> Suggestion:
    """Adayları can / mana / hedef olarak tahmin eder.

    Knight Online'da oyuncunun can ve mana barı sol üstte, hedefin can barı
    ekranın üst ortasındadır. Tahmin bu yerleşime dayanır; farklı bir arayüz
    kullanıyorsan adayı elle seçmen gerekir.
    """
    reds = [bar for bar in candidates if bar.kind == "can"]
    blues = [bar for bar in candidates if bar.kind == "mana"]
    suggestion = Suggestion()

    if reds:
        # Oyuncunun canı: en solda duran kırmızı bar.
        suggestion.hp = min(reds, key=lambda bar: bar.center_x)

        # Hedef barı: ekranın yatay ortasına en yakın, can barı olmayan kırmızı.
        others = [bar for bar in reds if bar is not suggestion.hp]
        if others:
            middle = screen_width / 2.0
            nearest = min(others, key=lambda bar: abs(bar.center_x - middle))
            # Gerçekten ortada mı? Değilse hedef barı yoktur (hedef seçili değil).
            if abs(nearest.center_x - middle) < screen_width * 0.25:
                suggestion.target = nearest

    if blues and suggestion.hp is not None:
        # Mana barı: can barına dikeyde en yakın mavi bar.
        suggestion.mp = min(blues, key=lambda bar: abs(bar.y - suggestion.hp.y))
    elif blues:
        suggestion.mp = blues[0]

    return suggestion


def build_vitals_patch(suggestion: Suggestion) -> dict[str, object]:
    """Tahminden ``vitals`` bölümü üretir."""
    patch: dict[str, object] = {"enabled": True}
    if suggestion.hp is not None:
        patch["hp"] = suggestion.hp.to_region()
    if suggestion.mp is not None:
        patch["mp"] = suggestion.mp.to_region()
    return patch


def build_farm_patch(suggestion: Suggestion) -> dict[str, object]:
    """Tahminden ``farm.target_bar`` üretir."""
    if suggestion.target is None:
        return {}
    return {"target_bar": suggestion.target.to_region()}
