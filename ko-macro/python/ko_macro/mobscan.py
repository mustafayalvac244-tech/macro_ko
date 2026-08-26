"""Ekrandaki mob isim etiketlerini bulma.

Oyun, mobların adını dünyada mobun üstünde çiziyor. Ekranı tarayıp bu yazı
kümelerini bulursak elimizde **görüş alanındaki moblar** listesi olur; Tab'ın
verdiği tek hedefe mahkûm kalmayız. Hafızaya dokunulmaz, sadece piksel okunur.

Bunun hafıza listesinden farkı var ve saklamıyorum:

* Ekranda görünmeyen mob (arkanda, tepenin ardında, kadraj dışında) yoktur.
* Bir şeyin arkasında kalan etiket bölünür ya da hiç çıkmaz.
* Mesafe bilinmez; sadece etiketin ekrandaki büyüklüğünden kabaca tahmin
  edilir (yakın mobun yazısı büyük görünür).
* Oyuncu adları, NPC'ler ve arayüz yazıları da aynı renkte olabilir — bunları
  ayıklamak için dışlanan bölgeler ve boyut sınırları var.

Yöntem: hedef renge yakın pikseller satır satır bulunur, aynı satırdaki
yakın parçalar birleştirilir, üst üste gelen satırlar tek etiket kutusuna
toplanır. Sonra boyut ve konum filtrelerinden geçenler aday olur.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .calibrate import Screen
from .nameplate import luminance

#: Aynı satırdaki iki parça bu kadar yakınsa aynı kelimenin harfleridir.
LETTER_GAP = 6

#: Etiketin makul boyut sınırları (piksel).
MIN_PLATE_WIDTH = 18
MAX_PLATE_WIDTH = 400
MIN_PLATE_HEIGHT = 5
MAX_PLATE_HEIGHT = 40


@dataclass
class ExcludedArea:
    """Taranmayacak ekran bölgesi (sohbet kutusu, arayüz panelleri...)."""

    x0: int
    y0: int
    x1: int
    y1: int

    def contains(self, x: int, y: int) -> bool:
        return self.x0 <= x <= self.x1 and self.y0 <= y <= self.y1

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ExcludedArea":
        return cls(int(raw["x0"]), int(raw["y0"]), int(raw["x1"]), int(raw["y1"]))


@dataclass
class Nameplate:
    """Ekranda bulunan bir isim etiketi."""

    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0 + 1

    @property
    def height(self) -> int:
        return self.y1 - self.y0 + 1

    @property
    def center(self) -> tuple[int, int]:
        return ((self.x0 + self.x1) // 2, (self.y0 + self.y1) // 2)

    @property
    def click_point(self) -> tuple[int, int]:
        """Tıklanacak nokta: etiketin biraz altı, yani mobun gövdesi.

        Etiketin kendisine tıklamak her arayüzde hedef seçmiyor; gövde daha
        güvenilir. Ne kadar aşağı ineceğimiz etiket yüksekliğine oranlı, çünkü
        yakın moblarda hem yazı hem gövde büyük.
        """
        x, _ = self.center
        return x, self.y1 + self.height * 2

    def distance_to(self, x: int, y: int) -> float:
        """Verilen noktaya uzaklık (ekran üzerinde)."""
        cx, cy = self.center
        return ((cx - x) ** 2 + (cy - y) ** 2) ** 0.5


@dataclass
class ScanSettings:
    """Etiket taramasının ayarları."""

    #: Etiket yazısının rengi ve toleransı.
    color: tuple[int, int, int] = (230, 230, 120)
    tolerance: int = 70
    #: Bu parlaklığın altındaki pikseller yazı sayılmaz (arka plan gürültüsü).
    min_luminance: int = 90
    #: Taranmayacak bölgeler.
    excluded: list[ExcludedArea] = field(default_factory=list)
    #: Boyut sınırları.
    min_width: int = MIN_PLATE_WIDTH
    max_width: int = MAX_PLATE_WIDTH
    min_height: int = MIN_PLATE_HEIGHT
    max_height: int = MAX_PLATE_HEIGHT

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ScanSettings":
        raw = raw or {}
        color = raw.get("color", [230, 230, 120])
        if len(color) != 3:
            raise ValueError(f"color 3 elemanlı RGB olmalı: {color!r}")
        settings = cls(
            color=(int(color[0]), int(color[1]), int(color[2])),
            tolerance=int(raw.get("tolerance", 70)),
            min_luminance=int(raw.get("min_luminance", 90)),
            excluded=[ExcludedArea.from_dict(a) for a in raw.get("excluded", [])],
            min_width=int(raw.get("min_width", MIN_PLATE_WIDTH)),
            max_width=int(raw.get("max_width", MAX_PLATE_WIDTH)),
            min_height=int(raw.get("min_height", MIN_PLATE_HEIGHT)),
            max_height=int(raw.get("max_height", MAX_PLATE_HEIGHT)),
        )
        if settings.min_width >= settings.max_width:
            raise ValueError("min_width < max_width olmalı")
        if settings.min_height >= settings.max_height:
            raise ValueError("min_height < max_height olmalı")
        return settings

    def to_dict(self) -> dict[str, Any]:
        return {
            "color": list(self.color),
            "tolerance": self.tolerance,
            "min_luminance": self.min_luminance,
            "excluded": [
                {"x0": a.x0, "y0": a.y0, "x1": a.x1, "y1": a.y1} for a in self.excluded
            ],
            "min_width": self.min_width,
            "max_width": self.max_width,
            "min_height": self.min_height,
            "max_height": self.max_height,
        }

    def matches(self, pixel: tuple[int, int, int]) -> bool:
        """Piksel etiket yazısı rengine yakın mı?"""
        if luminance(pixel) < self.min_luminance:
            return False
        return sum(abs(a - b) for a, b in zip(pixel, self.color)) <= self.tolerance * 3


def _row_runs(
    row, width: int, y: int, settings: ScanSettings
) -> list[tuple[int, int]]:
    """Bir satırdaki yazı parçalarını bulur ve harf aralıklarını birleştirir."""
    runs: list[tuple[int, int]] = []
    start: int | None = None

    for x in range(width):
        excluded = any(area.contains(x, y) for area in settings.excluded)
        hit = (not excluded) and settings.matches(row[x])
        if hit and start is None:
            start = x
        elif not hit and start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, width - 1))

    # Harfler arası boşluklar tek kelimeyi bölmesin.
    merged: list[tuple[int, int]] = []
    for run in runs:
        if merged and run[0] - merged[-1][1] - 1 <= LETTER_GAP:
            merged[-1] = (merged[-1][0], run[1])
        else:
            merged.append(run)
    return merged


def find_nameplates(
    screen: Screen, settings: ScanSettings | None = None, row_step: int = 1
) -> list[Nameplate]:
    """Ekrandaki isim etiketlerini bulur.

    Sonuç, en geniş etiket başta olacak şekilde sıralanır — geniş etiket
    genelde yakın mob demektir.
    """
    settings = settings or ScanSettings()
    open_plates: list[dict] = []
    finished: list[dict] = []

    for y in range(0, screen.height, max(1, row_step)):
        row = screen.row(y)
        runs = _row_runs(row, screen.width, y, settings)

        still_open: list[dict] = []
        for x0, x1 in runs:
            for plate in open_plates:
                # Üst satırdaki bir etiketle yatayda örtüşüyorsa aynı etiket.
                if x0 <= plate["x1"] and x1 >= plate["x0"] and y - plate["y1"] <= max(2, row_step):
                    plate["x0"] = min(plate["x0"], x0)
                    plate["x1"] = max(plate["x1"], x1)
                    plate["y1"] = y
                    if plate not in still_open:
                        still_open.append(plate)
                    break
            else:
                still_open.append({"x0": x0, "x1": x1, "y0": y, "y1": y})

        for plate in open_plates:
            if plate not in still_open:
                finished.append(plate)
        open_plates = still_open

    finished.extend(open_plates)

    plates = [
        Nameplate(x0=p["x0"], y0=p["y0"], x1=p["x1"], y1=p["y1"]) for p in finished
    ]
    plates = [
        plate
        for plate in plates
        if settings.min_width <= plate.width <= settings.max_width
        and settings.min_height <= plate.height <= settings.max_height
    ]
    plates.sort(key=lambda plate: plate.width, reverse=True)
    return plates


def nearest_to_center(plates: list[Nameplate], screen: Screen) -> Nameplate | None:
    """Ekranın ortasına en yakın etiket — karakterin baktığı yöndeki mob."""
    if not plates:
        return None
    center_x, center_y = screen.width // 2, screen.height // 2
    return min(plates, key=lambda plate: plate.distance_to(center_x, center_y))
