"""Can/mana barlarını ekrandan okuyup pot basma.

Bar, soldan sağa dolan bir şerit olduğu için ``x0..x1`` arası birkaç nokta
örneklenir; hedef renge yakın piksellerin oranı bar yüzdesini verir. Hafıza
okuma yok — sadece ekran görüntüsü.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Protocol

from .config import BarRegion, PotionRule, VitalsConfig
from .transport import Transport

log = logging.getLogger(__name__)


class ScreenSampler(Protocol):
    """Ekrandan piksel okuyan kaynak."""

    def sample_row(self, x0: int, x1: int, y: int, count: int) -> list[tuple[int, int, int]]:
        """``y`` satırında ``x0..x1`` arasından ``count`` adet RGB örneği alır."""


class MSSSampler:
    """``mss`` ile gerçek ekran görüntüsünden örnek alır."""

    def __init__(self) -> None:
        self._mss = None

    def _backend(self):
        if self._mss is None:
            try:
                import mss
            except ImportError as exc:  # pragma: no cover - ortama bağlı
                raise RuntimeError("mss kurulu değil: pip install mss") from exc
            self._mss = mss.mss()
        return self._mss

    def sample_row(self, x0: int, x1: int, y: int, count: int) -> list[tuple[int, int, int]]:
        width = max(1, x1 - x0 + 1)
        shot = self._backend().grab({"left": x0, "top": y, "width": width, "height": 1})
        raw = shot.raw  # BGRA
        samples: list[tuple[int, int, int]] = []
        for index in range(count):
            # Örnekleri şeridin içine eşit aralıkla dağıt.
            px = int(round(index * (width - 1) / max(1, count - 1)))
            offset = px * 4
            blue, green, red = raw[offset], raw[offset + 1], raw[offset + 2]
            samples.append((red, green, blue))
        return samples


class StaticSampler:
    """Test için: barları sabit yüzdelerde gösterir."""

    def __init__(self, fractions: dict[int, float] | None = None, default: float = 1.0) -> None:
        #: bar'ın y koordinatı -> doluluk oranı
        self.fractions = fractions or {}
        self.default = default
        self.color = (168, 32, 32)

    def sample_row(self, x0: int, x1: int, y: int, count: int) -> list[tuple[int, int, int]]:
        fraction = self.fractions.get(y, self.default)
        filled = int(round(fraction * count))
        return [self.color if i < filled else (12, 12, 12) for i in range(count)]


def color_matches(pixel: tuple[int, int, int], target: tuple[int, int, int], tolerance: int) -> bool:
    """Renk hedefe verilen toleransta yakın mı (kanal başına manhattan farkı)."""
    return sum(abs(a - b) for a, b in zip(pixel, target)) <= tolerance * 3


def read_bar(sampler: ScreenSampler, region: BarRegion) -> float:
    """Barın doluluk oranını 0-1 arasında döndürür."""
    samples = sampler.sample_row(region.x0, region.x1, region.y, region.samples)
    if not samples:
        return 0.0
    filled = sum(1 for pixel in samples if color_matches(pixel, region.color, region.tolerance))
    return filled / len(samples)


@dataclass
class VitalsSnapshot:
    """Son okuma."""

    hp_pct: float | None = None
    mp_pct: float | None = None
    at: float = 0.0


@dataclass
class VitalsMonitor:
    """Barları izler ve eşik altına inince pot tuşuna basar."""

    config: VitalsConfig
    sampler: ScreenSampler
    snapshot: VitalsSnapshot = field(default_factory=VitalsSnapshot)

    #: kural nesnesi kimliği -> son basma anı (monotonic)
    _last_use: dict[int, float] = field(default_factory=dict, init=False)
    _last_poll: float = field(default=float("-inf"), init=False)

    def read(self, now: float) -> VitalsSnapshot:
        """Barları okur ve son durumu günceller."""
        hp = read_bar(self.sampler, self.config.hp) if self.config.hp else None
        mp = read_bar(self.sampler, self.config.mp) if self.config.mp else None
        self.snapshot = VitalsSnapshot(hp_pct=hp, mp_pct=mp, at=now)
        return self.snapshot

    def due(self, now: float) -> bool:
        """Yeni bir okuma zamanı geldi mi?"""
        return (now - self._last_poll) * 1000.0 >= self.config.poll_ms

    def pick_potion(self, rules: list[PotionRule], pct: float | None, now: float) -> PotionRule | None:
        """Uygun potu seçer.

        Eşiği aşılmış kurallar arasından en düşük eşikli olan seçilir; yani
        can ne kadar azsa o kadar güçlü pot kullanılır. Cooldown'daki kurallar
        elenir.
        """
        if pct is None:
            return None
        candidates = [
            rule
            for rule in rules
            if pct * 100.0 < rule.below_pct and not self._on_cooldown(rule, now)
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda rule: rule.below_pct)

    def _on_cooldown(self, rule: PotionRule, now: float) -> bool:
        last = self._last_use.get(id(rule))
        if last is None:
            return False
        return (now - last) * 1000.0 < rule.cooldown_ms

    def tick(self, transport: Transport, now: float) -> list[str]:
        """Bir tur okuma + gerekiyorsa pot basma. Basılan tuşları döndürür."""
        if not self.config.enabled:
            return []
        if not self.due(now):
            return []
        self._last_poll = now
        snapshot = self.read(now)

        pressed: list[str] = []
        for rules, pct in (
            (self.config.hp_potions, snapshot.hp_pct),
            (self.config.mp_potions, snapshot.mp_pct),
        ):
            rule = self.pick_potion(rules, pct, now)
            if rule is None:
                continue
            transport.tap(rule.key, 45)
            self._last_use[id(rule)] = now
            pressed.append(rule.key)
            log.info(
                "pot: %s (%s) — bar %%%.0f",
                rule.key, rule.label or "eşik %.0f" % rule.below_pct, (pct or 0) * 100,
            )
        return pressed

    def combo_allowed(self) -> bool:
        """Can, combo çalıştırmak için yeterli mi?"""
        threshold = self.config.pause_combo_below_hp
        if threshold <= 0 or self.snapshot.hp_pct is None:
            return True
        return self.snapshot.hp_pct * 100.0 >= threshold


def create_monitor(config: VitalsConfig, sampler: ScreenSampler | None = None) -> VitalsMonitor:
    """Config'e göre izleyiciyi kurar."""
    return VitalsMonitor(config=config, sampler=sampler or MSSSampler())


# ------------------------------------------------------------------ hedef barı


@dataclass
class TargetState:
    """Seçili hedefin ekrandan okunan durumu."""

    present: bool = False
    hp_pct: float = 0.0
    at: float = 0.0

    @property
    def alive(self) -> bool:
        return self.present and self.hp_pct > 0.0


@dataclass
class TargetMonitor:
    """Ekranın üstündeki hedef can barını okur.

    Farm döngüsünün geri beslemesi budur: hedef seçildi mi, can azalıyor mu,
    öldü mü. Oyunun hafızasına dokunmaz — sadece piksel.
    """

    region: BarRegion
    #: Bu oranın altında dolu piksel varsa "hedef yok" sayılır.
    presence_threshold: float = 0.02
    state: TargetState = field(default_factory=TargetState)
    sampler: ScreenSampler | None = None

    def read(self, now: float) -> TargetState:
        sampler = self.sampler
        if sampler is None:
            raise RuntimeError("TargetMonitor için sampler gerekli")
        fraction = read_bar(sampler, self.region)
        self.state = TargetState(
            present=fraction > self.presence_threshold,
            hp_pct=fraction,
            at=now,
        )
        return self.state


@dataclass
class DamageWatch:
    """Hedefin canı gerçekten azalıyor mu diye bakar.

    Menzil dışındaysan ya da vuruşlar ıskalıyorsa bar sabit kalır; bu durumda
    döngü boşuna beklemek yerine yeni hedefe geçer.
    """

    stall_seconds: float = 4.0
    _last_hp: float | None = field(default=None, init=False)
    _last_change: float = field(default=0.0, init=False)

    def reset(self, now: float) -> None:
        self._last_hp = None
        self._last_change = now

    def update(self, state: TargetState, now: float) -> bool:
        """Canı azaldıysa ``True`` döner ve sayacı sıfırlar."""
        if self._last_hp is None or state.hp_pct < self._last_hp - 0.005:
            self._last_hp = state.hp_pct
            self._last_change = now
            return True
        self._last_hp = min(self._last_hp, state.hp_pct)
        return False

    def stalled(self, now: float) -> bool:
        """Uzun süredir hasar girmiyor mu?"""
        return (now - self._last_change) >= self.stall_seconds
