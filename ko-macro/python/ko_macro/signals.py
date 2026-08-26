"""Ekran sinyalleri: "şu kutuda şu görüntü var mı?"

Bu modülün varlık sebebi, tahmin etmeyi bırakmak. Parazit yedin mi, buff'ın
bitti mi, ekranda bir uyarı çıktı mı — bunları süreden tahmin etmek yerine
doğrudan ekrandan okuyabiliriz, **yeter ki nereye bakacağımızı bilelim.**

Oyunun arayüz yerleşimini ezberden bilmiyorum ve bilmediğim şeyi varsaymak
yanlış koda yol açıyor. Onun yerine kutuyu sen gösteriyorsun: bir kez
"şu ikon şu anda ekranda" diyorsun, program o kutunun görüntüsünü kaydediyor.
Sonrasında her turda aynı kutuya bakıp benziyor mu diye kontrol ediyor.

Neden renk imzası: buff/debuff ikonları şekilden çok **renkle** ayrışır. Yazı
için kullandığımız açık/koyu haritası ikonlarda zayıf kalıyor, o yüzden burada
kutu küçük bir ızgaraya bölünüp her hücrenin ortalama rengi saklanıyor.
Benzerlik de kanal farklarının ortalamasından hesaplanıyor — eşik etrafında
titremesin diye keskin eşleşme yerine yumuşak bir ölçü.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .calibrate import Screen

#: İmzanın indirgeneceği ızgara. Küçük tutmak gürültüye ve bir-iki piksellik
#: kaymaya dayanıklı yapar.
GRID_WIDTH = 6
GRID_HEIGHT = 6


class SignalError(ValueError):
    """Sinyal tanımı ya da okuması hatalı."""


@dataclass
class SignalRegion:
    """Ekranda izlenecek dikdörtgen."""

    x0: int
    y0: int
    x1: int
    y1: int

    def __post_init__(self) -> None:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise SignalError("sinyal bölgesinde x1 > x0 ve y1 > y0 olmalı")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SignalRegion":
        return cls(int(raw["x0"]), int(raw["y0"]), int(raw["x1"]), int(raw["y1"]))

    def to_dict(self) -> dict[str, int]:
        return {"x0": self.x0, "y0": self.y0, "x1": self.x1, "y1": self.y1}


def color_signature(screen: Screen, region: SignalRegion) -> list[int]:
    """Kutuyu ızgaraya bölüp her hücrenin ortalama rengini döndürür.

    Sonuç ``GRID_WIDTH * GRID_HEIGHT * 3`` uzunluğunda bir sayı dizisidir.
    """
    width = region.x1 - region.x0 + 1
    height = region.y1 - region.y0 + 1
    values: list[int] = []

    for grid_y in range(GRID_HEIGHT):
        y_start = region.y0 + grid_y * height // GRID_HEIGHT
        y_end = max(y_start + 1, region.y0 + (grid_y + 1) * height // GRID_HEIGHT)
        rows = [screen.row(y) for y in range(y_start, min(y_end, screen.height))]

        for grid_x in range(GRID_WIDTH):
            x_start = region.x0 + grid_x * width // GRID_WIDTH
            x_end = max(x_start + 1, region.x0 + (grid_x + 1) * width // GRID_WIDTH)

            totals = [0, 0, 0]
            count = 0
            for row in rows:
                for x in range(x_start, min(x_end, len(row))):
                    pixel = row[x]
                    totals[0] += pixel[0]
                    totals[1] += pixel[1]
                    totals[2] += pixel[2]
                    count += 1
            if count:
                values.extend(total // count for total in totals)
            else:
                values.extend((0, 0, 0))
    return values


def signature_to_text(values: list[int]) -> str:
    """İmzayı config'e yazılabilir metne çevirir."""
    return ",".join(str(int(value)) for value in values)


def signature_from_text(text: str) -> list[int]:
    """Metinden imzayı geri okur."""
    try:
        return [int(part) for part in str(text).split(",") if part != ""]
    except ValueError as exc:
        raise SignalError(f"bozuk sinyal imzası: {text!r}") from exc


def similarity(left: list[int], right: list[int]) -> float:
    """İki imzanın benzerliği (0-1).

    Kanal başına ortalama fark üzerinden; keskin eşleşme yerine yumuşak ölçü,
    böylece hafif parlaklık değişimi sinyali kaybettirmiyor.
    """
    if not left or len(left) != len(right):
        return 0.0
    difference = sum(abs(a - b) for a, b in zip(left, right)) / len(left)
    return max(0.0, 1.0 - difference / 255.0)


@dataclass
class Signal:
    """İzlenen tek bir ekran işareti."""

    name: str
    region: SignalRegion
    #: Öğretilmiş görüntü. Boşsa sinyal hiç eşleşmez.
    fingerprint: list[int] = field(default_factory=list)
    #: Eşleşme için gereken en az benzerlik.
    threshold: float = 0.92

    def __post_init__(self) -> None:
        if not self.name:
            raise SignalError("sinyalin adı boş olamaz")
        if not 0 < self.threshold <= 1:
            raise SignalError(f"{self.name}: threshold 0 ile 1 arasında olmalı")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Signal":
        try:
            return cls(
                name=str(raw["name"]),
                region=SignalRegion.from_dict(raw["region"]),
                fingerprint=signature_from_text(raw.get("fingerprint", "")),
                threshold=float(raw.get("threshold", 0.92)),
            )
        except KeyError as exc:
            raise SignalError(f"sinyalde eksik alan: {exc}") from exc

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "region": self.region.to_dict(),
            "fingerprint": signature_to_text(self.fingerprint),
            "threshold": self.threshold,
        }

    def score(self, screen: Screen) -> float:
        """Şu anki görüntünün öğretilene benzerliği."""
        if not self.fingerprint:
            return 0.0
        return similarity(color_signature(screen, self.region), self.fingerprint)

    def present(self, screen: Screen) -> bool:
        """İşaret şu an ekranda mı?"""
        return self.score(screen) >= self.threshold

    @property
    def box(self) -> tuple[int, int, int, int]:
        """Ekran yakalama kutusu."""
        return (self.region.x0, self.region.y0, self.region.x1, self.region.y1)


@dataclass
class SignalWatcher:
    """Tüm sinyalleri belirli aralıkla yoklar ve son durumu tutar."""

    signals: list[Signal] = field(default_factory=list)
    #: Yoklama aralığı (ms). Sinyaller hızlı değişmez, sık bakmaya gerek yok.
    poll_ms: int = 400
    #: Her sinyal için taze ekran üreten çağrı: ``factory(box) -> Screen``.
    screen_factory: Any = None

    state: dict[str, bool] = field(default_factory=dict, init=False)
    scores: dict[str, float] = field(default_factory=dict, init=False)
    _last_poll: float = field(default=float("-inf"), init=False)

    def due(self, now: float) -> bool:
        return (now - self._last_poll) * 1000.0 >= self.poll_ms

    def tick(self, now: float) -> dict[str, bool]:
        """Zamanı geldiyse tüm sinyalleri yeniden okur."""
        if not self.signals or self.screen_factory is None or not self.due(now):
            return self.state
        self._last_poll = now

        for signal in self.signals:
            try:
                screen = self.screen_factory(signal.box)
                self.scores[signal.name] = signal.score(screen)
                self.state[signal.name] = self.scores[signal.name] >= signal.threshold
            except Exception:
                # Okunamayan sinyal "yok" sayılır; kurallar tetiklenmez ama
                # döngü de durmaz.
                self.scores[signal.name] = 0.0
                self.state[signal.name] = False
        return self.state

    def is_on(self, name: str) -> bool:
        return bool(self.state.get(name, False))

    def known(self, name: str) -> bool:
        return any(signal.name == name for signal in self.signals)
