"""Hedef adını görüntüsünden tanıma.

Oyunun hafızasına bakmadan "bu harpy mi?" sorusuna cevap vermenin yolu:
hedef adının ekranda yazıldığı bölgenin **görüntüsünü** bir kez kaydetmek,
sonra her yeni hedefte aynı bölgeyi okuyup karşılaştırmak. Metni okumaz,
şeklini tanır.

Parmak izi, bölgedeki yazı piksellerinin küçültülmüş bir haritasıdır:
arka plandan ayrılan (yeterince parlak) pikseller 1, diğerleri 0. Bu, yazı
renginin ve arka planın değişmesine karşı dayanıklıdır — Knight Online'da
mob adının rengi seviye farkına göre değişir, o yüzden renge değil şekle
bakıyoruz.

Sınırları açıkça söylemek gerekirse:

* Çözünürlük ya da arayüz ölçeği değişirse parmak izi geçersiz olur.
* Aynı ada sahip farklı moblar ayırt edilemez (zaten aynı mob sayılırlar).
* Adın uzunluğu benzeyen moblar düşük eşikte karışabilir; eşiği yükselt.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .calibrate import Screen

#: Parmak izinin küçültüleceği ızgara — küçük tutmak gürültüye dayanıklı yapar.
GRID_WIDTH = 32
GRID_HEIGHT = 8

#: Bir pikselin "yazı" sayılması için gereken en az parlaklık.
DEFAULT_INK_THRESHOLD = 120


@dataclass
class NameRegion:
    """Hedef adının ekranda yazıldığı dikdörtgen."""

    x0: int
    y0: int
    x1: int
    y1: int
    ink_threshold: int = DEFAULT_INK_THRESHOLD

    def __post_init__(self) -> None:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("ad bölgesinde x1 > x0 ve y1 > y0 olmalı")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "NameRegion":
        return cls(
            x0=int(raw["x0"]),
            y0=int(raw["y0"]),
            x1=int(raw["x1"]),
            y1=int(raw["y1"]),
            ink_threshold=int(raw.get("ink_threshold", DEFAULT_INK_THRESHOLD)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "x0": self.x0, "y0": self.y0, "x1": self.x1, "y1": self.y1,
            "ink_threshold": self.ink_threshold,
        }


def luminance(pixel: tuple[int, int, int]) -> float:
    """Algısal parlaklık."""
    red, green, blue = pixel
    return 0.299 * red + 0.587 * green + 0.114 * blue


def fingerprint(screen: Screen, region: NameRegion) -> str:
    """Ad bölgesini ``GRID_WIDTH x GRID_HEIGHT`` bitlik bir imzaya indirger.

    Her ızgara hücresi, kapsadığı alanda yazı pikseli olup olmadığına göre
    '1' ya da '0' olur. Sonuç sabit uzunlukta bir metindir; config'e yazmak
    ve karşılaştırmak kolay olsun diye.
    """
    width = region.x1 - region.x0 + 1
    height = region.y1 - region.y0 + 1
    bits: list[str] = []

    for grid_y in range(GRID_HEIGHT):
        # Bu ızgara satırının kapsadığı ekran satırları.
        y_start = region.y0 + grid_y * height // GRID_HEIGHT
        y_end = region.y0 + (grid_y + 1) * height // GRID_HEIGHT
        y_end = max(y_end, y_start + 1)

        rows = [screen.row(y) for y in range(y_start, min(y_end, screen.height))]
        for grid_x in range(GRID_WIDTH):
            x_start = region.x0 + grid_x * width // GRID_WIDTH
            x_end = region.x0 + (grid_x + 1) * width // GRID_WIDTH
            x_end = max(x_end, x_start + 1)

            has_ink = any(
                luminance(row[x]) >= region.ink_threshold
                for row in rows
                for x in range(x_start, min(x_end, len(row)))
            )
            bits.append("1" if has_ink else "0")

    return "".join(bits)


def similarity(left: str, right: str) -> float:
    """İki parmak izinin ne kadar örtüştüğü (0-1).

    Uzunluklar farklıysa 0 döner — farklı sürümlerin imzası karıştırılmasın.
    """
    if not left or len(left) != len(right):
        return 0.0
    same = sum(1 for a, b in zip(left, right) if a == b)
    return same / len(left)


def is_blank(signature: str, max_ink_ratio: float = 0.02) -> bool:
    """İmza neredeyse boş mu? (hedef seçili değil / ad görünmüyor)"""
    if not signature:
        return True
    return signature.count("1") / len(signature) <= max_ink_ratio


@dataclass
class NameMatcher:
    """Kayıtlı adlarla karşılaştırıp hedefin istenen mob olup olmadığını söyler."""

    region: NameRegion
    #: Kabul edilen mob adlarının imzaları: görünen ad -> imza.
    signatures: dict[str, str]
    #: Kabul için gereken en az benzerlik.
    threshold: float = 0.85

    #: Son karşılaştırmanın sonucu — günlüğe ve panoya yazmak için.
    last_score: float = 0.0
    last_name: str = ""

    def match(self, screen: Screen) -> str | None:
        """Ekrandaki hedefe en çok benzeyen kayıtlı adı döndürür.

        Eşik altında kalırsa ``None``. Hiç kayıt yoksa (filtre kapalı sayılır)
        her hedef kabul edilir ve ``""`` döner.
        """
        if not self.signatures:
            self.last_score = 1.0
            self.last_name = ""
            return ""

        current = fingerprint(screen, self.region)
        if is_blank(current):
            self.last_score = 0.0
            self.last_name = ""
            return None

        best_name = ""
        best_score = 0.0
        for name, signature in self.signatures.items():
            score = similarity(current, signature)
            if score > best_score:
                best_name, best_score = name, score

        self.last_score = best_score
        self.last_name = best_name if best_score >= self.threshold else ""
        return best_name if best_score >= self.threshold else None

    def accepts(self, screen: Screen) -> bool:
        """Hedef kabul edilir mi?"""
        return self.match(screen) is not None
