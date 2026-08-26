"""Ekrandaki rakamları okuma.

Oyun, oyuncunun konumunu arayüzde yazıyor. Bu modül o yazıyı okur: hafızaya
ya da oyun sürecine dokunmaz, sadece piksele bakar.

Nasıl çalışıyor:

1. **Bölme.** Koordinat bölgesindeki sütunlar taranır; yazı pikseli olan
   ardışık sütunlar tek bir karakter kutusu sayılır, boşluklar ayırır.
2. **Normalleştirme.** Her karakter kendi sınırlarına kırpılıp sabit bir
   ızgaraya indirilir. Böylece rakamın ekrandaki yeri ve boyu değişse de
   imzası aynı kalır.
3. **Eşleştirme.** İmza, öğretilmiş rakam kalıplarıyla karşılaştırılır.

Öğretme: bir yerde durup gerçek koordinatını yazarsın. Program ekrandaki
karakterleri sırayla senin yazdığın rakamlarla eşleştirip kalıpları çıkarır.
Tek seferde göremediği rakamlar sonraki öğretmelerde eklenir.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .calibrate import Screen
from .nameplate import luminance, similarity

#: Karakter imzasının indirgeneceği ızgara.
GLYPH_WIDTH = 6
GLYPH_HEIGHT = 10

#: Bir sütunu "yazı var" saymak için gereken en az piksel sayısı.
MIN_INK_PIXELS = 1

#: Çok dar kutular gürültüdür (nokta, virgül kenarı vb.).
MIN_GLYPH_WIDTH = 2


class OcrError(ValueError):
    """Okuma ya da öğretme yapılamadı."""


@dataclass
class TextRegion:
    """Ekranda yazının okunacağı dikdörtgen."""

    x0: int
    y0: int
    x1: int
    y1: int
    ink_threshold: int = 140

    def __post_init__(self) -> None:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("yazı bölgesinde x1 > x0 ve y1 > y0 olmalı")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "TextRegion":
        return cls(
            x0=int(raw["x0"]), y0=int(raw["y0"]),
            x1=int(raw["x1"]), y1=int(raw["y1"]),
            ink_threshold=int(raw.get("ink_threshold", 140)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "x0": self.x0, "y0": self.y0, "x1": self.x1, "y1": self.y1,
            "ink_threshold": self.ink_threshold,
        }


# ------------------------------------------------------------------- bölme


def _ink_map(screen: Screen, region: TextRegion) -> list[list[bool]]:
    """Bölgeyi ``[satır][sütun]`` yazı/boşluk haritasına çevirir."""
    rows: list[list[bool]] = []
    for y in range(region.y0, min(region.y1 + 1, screen.height)):
        pixels = screen.row(y)
        rows.append(
            [
                luminance(pixels[x]) >= region.ink_threshold
                for x in range(region.x0, min(region.x1 + 1, len(pixels)))
            ]
        )
    return rows


def segment_glyphs(ink: list[list[bool]]) -> list[tuple[int, int]]:
    """Yazı sütunlarını karakter kutularına ayırır: ``(x0, x1)`` listesi."""
    if not ink:
        return []
    width = len(ink[0])
    columns = [
        sum(1 for row in ink if row[x]) >= MIN_INK_PIXELS for x in range(width)
    ]

    boxes: list[tuple[int, int]] = []
    start: int | None = None
    for x, has_ink in enumerate(columns):
        if has_ink and start is None:
            start = x
        elif not has_ink and start is not None:
            if x - start >= MIN_GLYPH_WIDTH:
                boxes.append((start, x - 1))
            start = None
    if start is not None and width - start >= MIN_GLYPH_WIDTH:
        boxes.append((start, width - 1))
    return boxes


def glyph_signature(ink: list[list[bool]], x0: int, x1: int) -> str:
    """Bir karakteri sabit ızgaralı imzaya indirger.

    Karakter önce kendi dikey sınırlarına kırpılır; böylece '1' ile '8' gibi
    farklı yükseklikteki rakamlar aynı ölçekte karşılaştırılır.
    """
    rows_with_ink = [
        y for y, row in enumerate(ink) if any(row[x] for x in range(x0, x1 + 1))
    ]
    if not rows_with_ink:
        return "0" * (GLYPH_WIDTH * GLYPH_HEIGHT)

    y0, y1 = rows_with_ink[0], rows_with_ink[-1]
    height = y1 - y0 + 1
    width = x1 - x0 + 1

    bits: list[str] = []
    for grid_y in range(GLYPH_HEIGHT):
        row_start = y0 + grid_y * height // GLYPH_HEIGHT
        row_end = max(row_start + 1, y0 + (grid_y + 1) * height // GLYPH_HEIGHT)
        for grid_x in range(GLYPH_WIDTH):
            col_start = x0 + grid_x * width // GLYPH_WIDTH
            col_end = max(col_start + 1, x0 + (grid_x + 1) * width // GLYPH_WIDTH)
            filled = any(
                ink[y][x]
                for y in range(row_start, min(row_end, len(ink)))
                for x in range(col_start, min(col_end, len(ink[0])))
            )
            bits.append("1" if filled else "0")
    return "".join(bits)


def read_glyphs(screen: Screen, region: TextRegion) -> list[str]:
    """Bölgedeki karakterlerin imzalarını soldan sağa döndürür."""
    return [signature for signature, _ in read_glyph_boxes(screen, region)]


def read_glyph_boxes(
    screen: Screen, region: TextRegion
) -> list[tuple[str, tuple[int, int]]]:
    """İmzaları kutularıyla birlikte döndürür.

    Kutular gerekli: sayıları ayıran şey her zaman bir işaret değil, bazen
    sadece boşluktur ("512 378"). Boşluk mürekkep bırakmadığı için karakter
    üretmez; iki sayıyı ayırdığını ancak kutular arasındaki mesafeden
    anlayabiliriz.
    """
    ink = _ink_map(screen, region)
    return [(glyph_signature(ink, x0, x1), (x0, x1)) for x0, x1 in segment_glyphs(ink)]


# -------------------------------------------------------------- tanıma/öğrenme


@dataclass
class DigitReader:
    """Öğretilmiş rakam kalıplarıyla ekrandaki sayıları okur.

    Bölge dışarıdan verilir: koordinat iki ayrı kutudan okunur (X için bir,
    Y için bir). Tek kutudan iki sayıyı boşluğa bakarak ayırmayı denemiyoruz —
    dar rakamlar ('1') normal harf aralığını boşluk gibi gösteriyor ve bu
    sessizce yanlış koordinat üretir.
    """

    #: karakter -> imza. Font sabit olduğu için karakter başına tek kalıp yeter.
    glyphs: dict[str, str] = field(default_factory=dict)
    #: Eşleşme için gereken en az benzerlik.
    threshold: float = 0.88

    def classify(self, signature: str) -> str | None:
        """Tek bir imzayı karaktere çevirir; tanıyamazsa ``None``."""
        best_char: str | None = None
        best_score = 0.0
        for char, known in self.glyphs.items():
            score = similarity(signature, known)
            if score > best_score:
                best_char, best_score = char, score
        return best_char if best_score >= self.threshold else None

    def read_text(self, screen: Screen, region: TextRegion) -> str:
        """Bölgedeki yazıyı okur. Tanınmayan karakter ``?`` olur."""
        if not self.glyphs:
            raise OcrError("hiç rakam öğretilmemiş — önce 'koordinat-ogren' çalıştır")
        return "".join(
            self.classify(sig) or "?" for sig in read_glyphs(screen, region)
        )

    def read_number(self, screen: Screen, region: TextRegion) -> int:
        """Bölgedeki tek sayıyı okur.

        Yarım okunmuş bir sayıyı kaydetmek yanlış veriden beterdir; tanınmayan
        karakter varsa hata verilir.
        """
        text = self.read_text(screen, region)
        digits = "".join(char for char in text if char.isdigit())
        if "?" in text or not digits:
            raise OcrError(
                f"sayı tam okunamadı: {text!r} — eksik rakamları öğret ya da "
                "bölgeyi düzelt"
            )
        return int(digits)

    def read_coordinates(
        self, screen: Screen, region_x: TextRegion, region_y: TextRegion
    ) -> tuple[int, int]:
        """İki bölgeden ``(x, y)`` okur."""
        return self.read_number(screen, region_x), self.read_number(screen, region_y)

    # -- öğrenme ----------------------------------------------------------

    def learn(self, screen: Screen, region: TextRegion, expected: str) -> list[str]:
        """Bölgedeki yazıyı ``expected`` ile eşleştirip kalıpları çıkarır.

        ``expected`` ekranda **yazdığı gibi** verilmeli. Boşluklar mürekkep
        bırakmadığı için yok sayılır. Yeni öğrenilen karakterleri döndürür.
        """
        chars = [char for char in expected.strip() if not char.isspace()]
        if not any(char.isdigit() for char in chars):
            raise OcrError("öğretmek için rakam içeren bir değer ver, örn. 512")

        signatures = read_glyphs(screen, region)
        if len(signatures) != len(chars):
            raise OcrError(
                f"bölgede {len(signatures)} karakter var, sen {len(chars)} karakter "
                f"yazdın ({''.join(chars)!r}). Bölge sadece o sayıyı kapsamalı."
            )

        learned: list[str] = []
        for char, signature in zip(chars, signatures):
            if char not in self.glyphs:
                learned.append(char)
            self.glyphs[char] = signature
        return learned

    @property
    def missing_digits(self) -> list[str]:
        """Henüz öğretilmemiş rakamlar."""
        return [d for d in "0123456789" if d not in self.glyphs]

    @property
    def complete(self) -> bool:
        return not self.missing_digits
