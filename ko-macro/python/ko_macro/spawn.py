"""Mob / boss doğuş takibi ve tahmini.

Her öldürme zamanı kaydedilir; kayıtlardan gerçek doğuş süresi öğrenilir ve
bir sonraki doğuş penceresi tahmin edilir. Ayrıca birden fazla doğuş noktası
varken hangisine sırayla gidileceğini planlayan basit bir rota çıkarıcı var.

Temel fikirler
--------------
* **Kaçırılan tur katlama.** İki öldürme arası süre, bilinen doğuş süresinin
  yaklaşık tam katıysa (ör. 3 tur kaçırılmışsa) bölünerek tek tura indirgenir.
  Yoksa tek bir kaçırılmış tur bütün istatistiği bozar.
* **Dayanıklı istatistik.** Ortalama yerine medyan ve MAD kullanılır; tek bir
  hatalı kayıt tahmini kaydırmaz.
* **Pencere.** Boss'ların doğuşu genelde sabit değil, bir aralıktır. Yeterli
  örnek biriktiğinde pencere gözlemden daraltılır, azken config'teki
  ``respawn_min_s``/``respawn_max_s`` kullanılır.
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

#: Gözlemden pencere daraltmak için gereken en az örnek sayısı.
MIN_SAMPLES_FOR_LEARNING = 3

#: Pencere kapandıktan sonra "gecikti" saymadan önce tanınan pay.
OVERDUE_GRACE_S = 60.0


class SpawnError(ValueError):
    """Doğuş noktası tanımı ya da kaydı hatalı."""


# ------------------------------------------------------------------ istatistik


def median(values: Iterable[float]) -> float:
    """Medyan. Boş dizide 0 döner."""
    data = sorted(values)
    if not data:
        return 0.0
    mid = len(data) // 2
    if len(data) % 2:
        return data[mid]
    return (data[mid - 1] + data[mid]) / 2.0


def median_absolute_deviation(values: Iterable[float]) -> float:
    """Medyandan sapmaların medyanı — aykırı değerlere karşı dayanıklı yayılım."""
    data = list(values)
    if len(data) < 2:
        return 0.0
    center = median(data)
    return median(abs(value - center) for value in data)


def normal_cdf(x: float, mean: float, sigma: float) -> float:
    """Normal dağılımın birikimli olasılığı."""
    if sigma <= 0:
        return 1.0 if x >= mean else 0.0
    return 0.5 * (1.0 + math.erf((x - mean) / (sigma * math.sqrt(2.0))))


def fold_interval(delta: float, expected: float, low: float, high: float) -> float | None:
    """Kaçırılmış turları hesaba katarak aralığı tek tura indirger.

    ``delta`` beklenen sürenin yaklaşık ``k`` katıysa ``delta / k`` döner,
    hiçbir tam kata oturmuyorsa ``None`` (kayıt güvenilmez sayılır).

    >>> fold_interval(3600, 1200, 900, 1500)   # 3 tur kaçırılmış
    1200.0
    >>> fold_interval(50, 1200, 900, 1500) is None
    True
    """
    if delta <= 0 or expected <= 0:
        return None
    cycles = max(1, round(delta / expected))
    folded = delta / cycles
    if low <= folded <= high:
        return float(folded)
    return None


# --------------------------------------------------------------------- modeller


@dataclass
class SpawnPoint:
    """Tek bir mob/boss doğuş noktası."""

    id: str
    name: str
    zone: str = ""
    respawn_min_s: float = 600.0
    respawn_max_s: float = 900.0
    priority: int = 1
    notes: str = ""
    #: Oyun içi konum. ``koordinat-ogren`` kurulduysa ekrandan okunur, yoksa
    #: elle girilir. Yol sürelerini mesafeden tahmin etmek için kullanılır.
    x: int | None = None
    y: int | None = None
    #: Öldürme zamanları (unix epoch, artan sırada).
    kills: list[float] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.id:
            raise SpawnError("doğuş noktasının id'si boş olamaz")
        if self.respawn_min_s <= 0:
            raise SpawnError(f"{self.id}: respawn_min_s pozitif olmalı")
        if self.respawn_max_s < self.respawn_min_s:
            raise SpawnError(f"{self.id}: respawn_max_s, respawn_min_s'ten küçük olamaz")
        self.kills = sorted(float(k) for k in self.kills)

    # -- öğrenme -----------------------------------------------------------

    @property
    def nominal_s(self) -> float:
        """Config'e göre pencerenin ortası."""
        return (self.respawn_min_s + self.respawn_max_s) / 2.0

    def observed_intervals(self) -> list[float]:
        """Kayıtlardan çıkarılan, kaçırılan turlara göre düzeltilmiş süreler."""
        intervals: list[float] = []
        # Kaçırılan turları ayıklarken pencereyi biraz geniş tutuyoruz ki
        # gerçek dalgalanma kırpılmasın.
        low = self.respawn_min_s * 0.8
        high = self.respawn_max_s * 1.2
        for previous, current in zip(self.kills, self.kills[1:]):
            folded = fold_interval(current - previous, self.nominal_s, low, high)
            if folded is not None:
                intervals.append(folded)
        return intervals

    def learned_window(self) -> tuple[float, float, int]:
        """``(min, max, örnek sayısı)`` — yeterli veri varsa gözlemden daraltılmış."""
        intervals = self.observed_intervals()
        if len(intervals) < MIN_SAMPLES_FOR_LEARNING:
            return self.respawn_min_s, self.respawn_max_s, len(intervals)

        center = median(intervals)
        spread = median_absolute_deviation(intervals)
        # MAD -> standart sapma yaklaşımı (normal dağılım için 1.4826 katsayısı),
        # ve iki sigmalık bir pencere.
        sigma = max(spread * 1.4826, self.nominal_s * 0.01)
        low = max(self.respawn_min_s * 0.5, center - 2 * sigma)
        high = min(self.respawn_max_s * 1.5, center + 2 * sigma)
        if high <= low:
            return self.respawn_min_s, self.respawn_max_s, len(intervals)
        return low, high, len(intervals)

    # -- kayıt -------------------------------------------------------------

    @property
    def last_kill(self) -> float | None:
        return self.kills[-1] if self.kills else None

    def record_kill(self, at: float | None = None, keep: int = 40) -> float:
        """Bir öldürmeyi kaydeder, kayıt zamanını döndürür."""
        moment = float(at if at is not None else time.time())
        self.kills.append(moment)
        self.kills.sort()
        if len(self.kills) > keep:
            del self.kills[: len(self.kills) - keep]
        return moment

    # -- serileştirme ------------------------------------------------------

    @property
    def position(self) -> tuple[int, int] | None:
        """Konum, ikisi de biliniyorsa."""
        if self.x is None or self.y is None:
            return None
        return self.x, self.y

    def distance_to(self, other: "SpawnPoint") -> float | None:
        """İki nokta arası düz mesafe; biri konumsuzsa ``None``."""
        here, there = self.position, other.position
        if here is None or there is None:
            return None
        return math.hypot(here[0] - there[0], here[1] - there[1])

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "zone": self.zone,
            "respawn_min_s": self.respawn_min_s,
            "respawn_max_s": self.respawn_max_s,
            "priority": self.priority,
            "notes": self.notes,
            "x": self.x,
            "y": self.y,
            "kills": self.kills,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SpawnPoint":
        try:
            return cls(
                id=str(raw["id"]),
                name=str(raw.get("name", raw["id"])),
                zone=str(raw.get("zone", "")),
                respawn_min_s=float(raw.get("respawn_min_s", 600.0)),
                respawn_max_s=float(raw.get("respawn_max_s", 900.0)),
                priority=int(raw.get("priority", 1)),
                notes=str(raw.get("notes", "")),
                x=int(raw["x"]) if raw.get("x") is not None else None,
                y=int(raw["y"]) if raw.get("y") is not None else None,
                kills=[float(k) for k in raw.get("kills", [])],
            )
        except KeyError as exc:
            raise SpawnError(f"doğuş noktasında eksik alan: {exc}") from exc


@dataclass
class SpawnPrediction:
    """Bir doğuş noktasının anlık durumu."""

    point_id: str
    name: str
    zone: str
    state: str  # bilinmiyor | bekliyor | pencere | gecikti
    last_kill: float | None
    window_open: float | None
    window_close: float | None
    eta_s: float | None          # pencerenin açılmasına kalan (negatifse açık)
    probability_now: float       # şu an doğmuş olma olasılığı
    confidence: float            # tahmine güven (0-1)
    samples: int
    missed_cycles: int
    priority: int

    @property
    def is_actionable(self) -> bool:
        """Pencere açık ya da açılmak üzere mi?"""
        return self.state in {"pencere", "gecikti"} or (
            self.eta_s is not None and self.eta_s <= 120
        )


def predict(point: SpawnPoint, now: float | None = None) -> SpawnPrediction:
    """Bir doğuş noktası için sıradaki pencereyi tahmin eder."""
    moment = float(now if now is not None else time.time())
    low, high, samples = point.learned_window()
    intervals = point.observed_intervals()
    last = point.last_kill

    if last is None:
        return SpawnPrediction(
            point_id=point.id, name=point.name, zone=point.zone, state="bilinmiyor",
            last_kill=None, window_open=None, window_close=None, eta_s=None,
            probability_now=0.0, confidence=0.0, samples=samples, missed_cycles=0,
            priority=point.priority,
        )

    window_open = last + low
    window_close = last + high
    missed = 0
    # Pencere kapandıysa ve hâlâ öldürme kaydı gelmediyse, tur tur ileri sar.
    while moment > window_close + OVERDUE_GRACE_S:
        missed += 1
        window_open += (low + high) / 2.0
        window_close += (low + high) / 2.0
        if missed > 100:  # bozuk veriye karşı emniyet
            break

    eta = window_open - moment
    if eta > 0:
        state = "bekliyor"
    elif moment <= window_close:
        state = "pencere"
    else:
        state = "gecikti"

    # Doğmuş olma olasılığı: örnek varsa normal dağılım, yoksa pencere içinde
    # düzgün dağılım varsayılır.
    if samples >= MIN_SAMPLES_FOR_LEARNING and intervals:
        center = median(intervals)
        sigma = max(median_absolute_deviation(intervals) * 1.4826, 1.0)
        probability = normal_cdf(moment - last - missed * center, center, sigma)
    else:
        span = max(window_close - window_open, 1e-6)
        probability = (moment - window_open) / span
    probability = min(1.0, max(0.0, probability))

    # Güven: örnek sayısı arttıkça ve pencere daraldıkça yükselir.
    sample_score = min(1.0, samples / 8.0)
    span_ratio = (high - low) / max(point.nominal_s, 1e-6)
    tightness = max(0.0, 1.0 - min(1.0, span_ratio))
    confidence = round(0.35 * sample_score + 0.65 * tightness, 3) if samples else 0.15
    if missed:
        confidence *= 0.6  # kaçırılan turlar tahmini zayıflatır

    return SpawnPrediction(
        point_id=point.id, name=point.name, zone=point.zone, state=state,
        last_kill=last, window_open=window_open, window_close=window_close,
        eta_s=eta, probability_now=probability, confidence=round(confidence, 3),
        samples=samples, missed_cycles=missed, priority=point.priority,
    )


# ------------------------------------------------------------------- rota planı


@dataclass
class RouteStop:
    """Rotadaki tek durak."""

    point_id: str
    name: str
    travel_s: float
    arrive_at: float
    wait_s: float
    score: float


def catch_score(prediction: SpawnPrediction, arrival: float) -> float:
    """Verilen varış anında bossu yakalama şansı (0-1).

    Pencere açılmadan varmak en iyisidir; pencere ilerledikçe başkasının
    almış olma ihtimali arttığı için puan düşer.
    """
    if prediction.window_open is None or prediction.window_close is None:
        return 0.0
    if arrival <= prediction.window_open:
        return 1.0
    span = max(prediction.window_close - prediction.window_open, 1e-6)
    if arrival <= prediction.window_close:
        return max(0.0, 1.0 - (arrival - prediction.window_open) / span)
    return 0.1  # pencere geçmiş olsa da kimse almamış olabilir


def plan_route(
    predictions: list[SpawnPrediction],
    now: float,
    travel_seconds: dict[tuple[str, str], float] | None = None,
    default_travel_s: float = 90.0,
    start_at: str | None = None,
    kill_seconds: float = 45.0,
    max_stops: int = 6,
    horizon_s: float = 3600.0,
) -> list[RouteStop]:
    """Doğuş noktaları arasında açgözlü bir gezinme sırası çıkarır.

    Her adımda "yakalama şansı × öncelik / (yol + bekleme maliyeti)" en yüksek
    olan nokta seçilir, saat ilerletilir ve kalanlar için tekrar hesaplanır.
    """
    travel_seconds = travel_seconds or {}
    remaining = {p.point_id: p for p in predictions if p.window_open is not None}
    route: list[RouteStop] = []
    position = start_at
    clock = now

    while remaining and len(route) < max_stops:
        best: tuple[float, RouteStop] | None = None
        for prediction in remaining.values():
            if position is None or position == prediction.point_id:
                travel = 0.0  # başlangıç noktası ya da zaten oradayız
            else:
                travel = travel_seconds.get(
                    (position, prediction.point_id), default_travel_s
                )
            arrival = clock + travel
            assert prediction.window_open is not None
            wait = max(0.0, prediction.window_open - arrival)
            cost_minutes = (travel + wait) / 60.0
            value = catch_score(prediction, arrival) * max(1, prediction.priority)
            score = value / (1.0 + cost_minutes)

            if arrival + wait > now + horizon_s:
                continue
            stop = RouteStop(
                point_id=prediction.point_id, name=prediction.name, travel_s=travel,
                arrive_at=arrival, wait_s=wait, score=round(score, 4),
            )
            if best is None or score > best[0]:
                best = (score, stop)

        if best is None:
            break
        _, stop = best
        route.append(stop)
        remaining.pop(stop.point_id)
        position = stop.point_id
        clock = stop.arrive_at + stop.wait_s + kill_seconds

    return route


# ------------------------------------------------------------------ kalıcı depo


class SpawnBook:
    """Doğuş noktalarını JSON dosyasında tutar."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.points: dict[str, SpawnPoint] = {}
        self.travel_seconds: dict[tuple[str, str], float] = {}
        self.default_travel_s = 90.0
        #: Koordinat biriminin saniyeye çevrimi (karakter hızı). Konumu bilinen
        #: iki nokta arasında yol süresi elle girilmemişse buradan tahmin edilir.
        self.units_per_second = 12.0

    # -- dosya -------------------------------------------------------------

    def load(self) -> "SpawnBook":
        if not self.path.is_file():
            return self
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SpawnError(f"{self.path} okunamadı: {exc}") from exc

        self.points = {}
        for item in raw.get("points", []):
            point = SpawnPoint.from_dict(item)
            self.points[point.id] = point

        self.default_travel_s = float(raw.get("default_travel_s", 90.0))
        self.units_per_second = float(raw.get("units_per_second", 12.0)) or 12.0
        self.travel_seconds = {}
        for item in raw.get("travel", []):
            self.travel_seconds[(str(item["from"]), str(item["to"]))] = float(item["seconds"])
        return self

    def save(self) -> None:
        payload = {
            "version": 1,
            "default_travel_s": self.default_travel_s,
            "units_per_second": self.units_per_second,
            "points": [point.to_dict() for point in self.points.values()],
            "travel": [
                {"from": a, "to": b, "seconds": seconds}
                for (a, b), seconds in sorted(self.travel_seconds.items())
            ],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Önce geçici dosyaya yaz: yazma sırasında çakılırsa kayıtlar kaybolmasın.
        temp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(self.path)

    # -- işlemler ----------------------------------------------------------

    def add(self, point: SpawnPoint) -> SpawnPoint:
        if point.id in self.points:
            raise SpawnError(f"bu id zaten var: {point.id}")
        self.points[point.id] = point
        return point

    def remove(self, point_id: str) -> None:
        if point_id not in self.points:
            raise SpawnError(f"doğuş noktası yok: {point_id}")
        del self.points[point_id]

    def get(self, point_id: str) -> SpawnPoint:
        try:
            return self.points[point_id]
        except KeyError:
            raise SpawnError(
                f"doğuş noktası yok: {point_id!r} "
                f"(mevcut: {', '.join(sorted(self.points)) or 'yok'})"
            ) from None

    def record_kill(self, point_id: str, at: float | None = None) -> float:
        moment = self.get(point_id).record_kill(at)
        self.save()
        return moment

    def set_travel(self, source: str, target: str, seconds: float, both_ways: bool = True) -> None:
        self.travel_seconds[(source, target)] = float(seconds)
        if both_ways:
            self.travel_seconds[(target, source)] = float(seconds)

    def predictions(self, now: float | None = None) -> list[SpawnPrediction]:
        """Tüm noktaların tahminini, en acili başta olacak şekilde döndürür."""
        moment = float(now if now is not None else time.time())
        results = [predict(point, moment) for point in self.points.values()]

        def sort_key(prediction: SpawnPrediction) -> tuple[int, float]:
            order = {"pencere": 0, "gecikti": 1, "bekliyor": 2, "bilinmiyor": 3}
            return (order.get(prediction.state, 9), prediction.eta_s or 0.0)

        return sorted(results, key=sort_key)

    def estimated_travel(self) -> dict[tuple[str, str], float]:
        """Elle girilen yol süreleri + koordinatlardan tahmin edilenler.

        Elle girilen değer her zaman kazanır; sadece eksik olan çiftler
        mesafeden doldurulur.
        """
        estimated: dict[tuple[str, str], float] = {}
        points = list(self.points.values())
        for source in points:
            for target in points:
                if source.id == target.id:
                    continue
                key = (source.id, target.id)
                if key in self.travel_seconds:
                    continue
                distance = source.distance_to(target)
                if distance is None:
                    continue
                estimated[key] = distance / self.units_per_second
        estimated.update(self.travel_seconds)
        return estimated

    def route(self, now: float | None = None, **kwargs: Any) -> list[RouteStop]:
        """Aktif tahminler üzerinden gezinme sırası çıkarır."""
        moment = float(now if now is not None else time.time())
        kwargs.setdefault("travel_seconds", self.estimated_travel())
        kwargs.setdefault("default_travel_s", self.default_travel_s)
        return plan_route(self.predictions(moment), moment, **kwargs)


def format_eta(seconds: float | None) -> str:
    """Saniyeyi ``12d 30s`` gibi kısa bir metne çevirir."""
    if seconds is None:
        return "-"
    sign = "-" if seconds < 0 else ""
    total = int(abs(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{sign}{hours}s {minutes:02d}d"
    if minutes:
        return f"{sign}{minutes}d {secs:02d}s"
    return f"{sign}{secs}s"
