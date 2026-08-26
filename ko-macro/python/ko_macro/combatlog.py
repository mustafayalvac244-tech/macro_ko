"""Savaş kaydını okuma: oyunun kendi yazdığı olayları yakalamak.

Knight Online savaş kaydına şunları yazıyor:

    [Captain] Uruk'khthrone received 569 damage
    Using arrow shower
    Earned 10925 Experience Points

Bunlar oyunun iç durumunu **kendi isteğiyle** ekrana basması. Hafızaya
dokunmadan alınabilecek en kesin veri burada:

* ``Earned ... Experience Points``  → mob öldü. Hedef barının boşalmasını
  beklemekten çok daha güvenilir; bar yanlış okunsa bile çalışır.
* ``received ... damage``           → vuruş girdi, hedef menzilde.
* ``Using <skill>``                 → skill gerçekten çıktı.

Neden tam OCR değil
-------------------
Satırların tamamını okumak için bütün alfabeyi öğretmek gerekirdi — kullanıcı
için çekilmez. Oysa bize satırın **anlamı** değil, içinde belirli bir kalıbın
geçip geçmediği lazım. O yüzden kelimenin görüntüsünü öğreniyoruz ve satır
boyunca kaydırarak arıyoruz.

Mob adı satırın başında olduğu için kalıbın yeri sabit değil (``received``
her satırda farklı sütunda başlıyor). Kaydırmalı arama bunu çözüyor.

Karşılaştırma 2 boyutlu değil: her sütundaki yazı pikseli sayısı çıkarılıp
tek boyutlu bir profil olarak eşleştiriliyor. Hem yeterince ayırt edici hem
de her yoklamada tüm satırları taramaya elverecek kadar ucuz.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .calibrate import Screen
from .nameplate import luminance


@dataclass
class LogRegion:
    """Savaş kaydının ekranda kapladığı alan."""

    x0: int
    y0: int
    x1: int
    y1: int
    #: Bir satırın yüksekliği (piksel). Satırlara bölmek için gerekli.
    line_height: int = 14
    #: Yazı sayılacak en az parlaklık.
    ink_threshold: int = 120

    def __post_init__(self) -> None:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("kayıt bölgesinde x1 > x0 ve y1 > y0 olmalı")
        if self.line_height < 4:
            raise ValueError("line_height en az 4 olmalı")

    @property
    def line_count(self) -> int:
        return max(1, (self.y1 - self.y0 + 1) // self.line_height)

    def line_bounds(self, index: int) -> tuple[int, int]:
        """``index``'inci satırın üst ve alt y sınırı."""
        top = self.y0 + index * self.line_height
        return top, min(top + self.line_height - 1, self.y1)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "LogRegion":
        return cls(
            x0=int(raw["x0"]), y0=int(raw["y0"]),
            x1=int(raw["x1"]), y1=int(raw["y1"]),
            line_height=int(raw.get("line_height", 14)),
            ink_threshold=int(raw.get("ink_threshold", 120)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "x0": self.x0, "y0": self.y0, "x1": self.x1, "y1": self.y1,
            "line_height": self.line_height, "ink_threshold": self.ink_threshold,
        }


def column_profile(
    screen: Screen, region: LogRegion, top: int, bottom: int
) -> list[int]:
    """Bir satır şeridindeki her sütunun yazı piksel sayısı."""
    width = region.x1 - region.x0 + 1
    profile = [0] * width
    for y in range(top, min(bottom + 1, screen.height)):
        row = screen.row(y)
        for index in range(width):
            if luminance(row[region.x0 + index]) >= region.ink_threshold:
                profile[index] += 1
    return profile


def trim_profile(profile: list[int]) -> list[int]:
    """Profilin baş ve sonundaki boşlukları atar."""
    start = 0
    end = len(profile)
    while start < end and profile[start] == 0:
        start += 1
    while end > start and profile[end - 1] == 0:
        end -= 1
    return profile[start:end]


def profile_similarity(window: list[int], template: list[int]) -> float:
    """İki profilin benzerliği (0-1)."""
    if not template or len(window) != len(template):
        return 0.0
    total = sum(max(a, b) for a, b in zip(window, template))
    if total == 0:
        return 1.0
    difference = sum(abs(a - b) for a, b in zip(window, template))
    return max(0.0, 1.0 - difference / total)


def contains_phrase(
    line: list[int], template: list[int], threshold: float = 0.82
) -> bool:
    """Kalıp satırın herhangi bir yerinde geçiyor mu?

    Kalıbın satırdaki yeri sabit olmadığı için pencere kaydırılarak aranır.
    """
    if not template or len(template) > len(line):
        return False
    for offset in range(len(line) - len(template) + 1):
        window = line[offset : offset + len(template)]
        if profile_similarity(window, template) >= threshold:
            return True
    return False


@dataclass
class Phrase:
    """Kayıtta aranan öğrenilmiş kalıp."""

    name: str
    profile: list[int] = field(default_factory=list)
    threshold: float = 0.82

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Phrase":
        return cls(
            name=str(raw["name"]),
            profile=[int(value) for value in str(raw.get("profile", "")).split(",") if value],
            threshold=float(raw.get("threshold", 0.82)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "profile": ",".join(str(value) for value in self.profile),
            "threshold": self.threshold,
        }


@dataclass
class LogEvent:
    """Kayıtta görülen bir olay."""

    phrase: str
    line: int


@dataclass
class CombatLogWatcher:
    """Kaydı yoklar ve **yeni** görünen kalıpları bildirir.

    Kayıt kaydığı için aynı satır birkaç yoklamada görünmeye devam eder.
    Aynı olayın tekrar tekrar sayılmaması için görülen satırların parmak izi
    tutulur; sadece daha önce görülmemiş satırlar olay üretir.
    """

    region: LogRegion
    phrases: list[Phrase] = field(default_factory=list)
    poll_ms: int = 250

    _seen: set[tuple[int, ...]] = field(default_factory=set, init=False)
    _last_poll: float = field(default=float("-inf"), init=False)
    #: Her kalıptan kaç olay görüldüğü.
    counts: dict[str, int] = field(default_factory=dict, init=False)

    def due(self, now: float) -> bool:
        return (now - self._last_poll) * 1000.0 >= self.poll_ms

    def read(self, screen: Screen) -> list[LogEvent]:
        """Kaydı okur ve yeni olayları döndürür (yoklama aralığına bakmaz)."""
        events: list[LogEvent] = []
        for index in range(self.region.line_count):
            top, bottom = self.region.line_bounds(index)
            profile = trim_profile(column_profile(screen, self.region, top, bottom))
            if not profile:
                continue

            key = tuple(profile)
            if key in self._seen:
                continue
            self._seen.add(key)

            for phrase in self.phrases:
                if contains_phrase(profile, phrase.profile, phrase.threshold):
                    events.append(LogEvent(phrase=phrase.name, line=index))
                    self.counts[phrase.name] = self.counts.get(phrase.name, 0) + 1

        # Hafıza sınırsız büyümesin; kayıt kaydıkça eski satırlar gereksizleşir.
        if len(self._seen) > 400:
            self._seen.clear()
        return events

    def tick(self, screen_factory, now: float) -> list[LogEvent]:
        """Zamanı geldiyse kaydı okur."""
        if not self.phrases or not self.due(now):
            return []
        self._last_poll = now
        try:
            screen = screen_factory(
                (self.region.x0, self.region.y0, self.region.x1, self.region.y1)
            )
        except Exception:
            return []
        return self.read(screen)

    def learn(self, screen: Screen, name: str, line_index: int) -> Phrase:
        """Verilen satırın tamamını kalıp olarak kaydeder.

        Kalıbı satırın sabit kısmına daraltmak kullanıcının işi: bölgeyi o
        kısmı kapsayacak şekilde vermesi yeterli.
        """
        top, bottom = self.region.line_bounds(line_index)
        profile = trim_profile(column_profile(screen, self.region, top, bottom))
        if not profile:
            raise ValueError(f"{line_index}. satır boş görünüyor")
        phrase = Phrase(name=name, profile=profile)
        self.phrases = [p for p in self.phrases if p.name != name] + [phrase]
        return phrase
