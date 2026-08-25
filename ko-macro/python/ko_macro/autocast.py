"""Arka planda kendi kendine çalışan tekrarlı yetenekler.

Buff yenileme, malice, parazit temizleme, descent, tamir — hepsi "şu kadar
sürede bir bas" ya da "can şu seviyenin altına inince bas" kuralıdır.

Dürüst olmak gerekirse: oyunun durumunu okumadığımız için "parazit yedin mi"
sorusunu bilemeyiz. Bu yüzden temizleme/CC kuralları **süreye** dayanır, olaya
değil. Can ve mana koşulları ise ekrandan gerçekten okunur.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field

from .timing import apply_jitter

log = logging.getLogger(__name__)


@dataclass
class AutoCastRule:
    """Kendi kendine tetiklenen tek bir kural."""

    name: str
    #: Çalıştırılacak combo adı ya da doğrudan basılacak tuş (biri dolu olmalı).
    combo: str | None = None
    key: str | None = None
    #: Kaç saniyede bir. 0 ise sadece koşullar tetikler.
    every_s: float = 0.0
    #: Can/mana bu yüzdenin altındayken tetikle.
    when_hp_below: float | None = None
    when_mp_below: float | None = None
    #: Sadece farm döngüsü açıkken çalışsın mı?
    only_when_farming: bool = False
    enabled: bool = True
    #: Aralığa uygulanacak ± yüzde; hepsi aynı anda tetiklenmesin diye.
    jitter_pct: float = 10.0

    def __post_init__(self) -> None:
        if bool(self.combo) == bool(self.key):
            raise ValueError(
                f"{self.name!r}: 'combo' ya da 'key' alanlarından tam olarak biri dolu olmalı"
            )
        if self.every_s <= 0 and self.when_hp_below is None and self.when_mp_below is None:
            raise ValueError(
                f"{self.name!r}: en az bir tetikleyici gerekli (every_s / when_hp_below / when_mp_below)"
            )

    @classmethod
    def from_dict(cls, raw: dict) -> "AutoCastRule":
        return cls(
            name=str(raw["name"]),
            combo=raw.get("combo"),
            key=raw.get("key"),
            every_s=float(raw.get("every_s", 0.0)),
            when_hp_below=(
                float(raw["when_hp_below"]) if raw.get("when_hp_below") is not None else None
            ),
            when_mp_below=(
                float(raw["when_mp_below"]) if raw.get("when_mp_below") is not None else None
            ),
            only_when_farming=bool(raw.get("only_when_farming", False)),
            enabled=bool(raw.get("enabled", True)),
            jitter_pct=float(raw.get("jitter_pct", 10.0)),
        )


@dataclass
class AutoCaster:
    """Kuralları izler ve zamanı gelenleri bildirir."""

    rules: list[AutoCastRule] = field(default_factory=list)
    rng: random.Random = field(default_factory=random.Random)

    #: kural adı -> bir sonraki tetikleme anı (monotonic)
    _next_due: dict[str, float] = field(default_factory=dict, init=False)

    def prime(self, now: float) -> None:
        """İlk tetikleme zamanlarını dağıtır.

        Hepsi aynı anda patlamasın diye ilk tur rastgele bir noktadan başlar.
        """
        for rule in self.rules:
            if rule.every_s > 0:
                self._next_due[rule.name] = now + self.rng.uniform(0, rule.every_s)
            else:
                self._next_due[rule.name] = now

    def due(
        self,
        now: float,
        hp_pct: float | None = None,
        mp_pct: float | None = None,
        farming: bool = False,
    ) -> list[AutoCastRule]:
        """Şu an tetiklenmesi gereken kuralları döndürür."""
        ready: list[AutoCastRule] = []
        for rule in self.rules:
            if not rule.enabled:
                continue
            if rule.only_when_farming and not farming:
                continue
            if now < self._next_due.get(rule.name, 0.0):
                continue

            # Koşullu kural: eşik aşılmadıysa tetiklenmez ama sayaç da ilerlemez.
            if rule.when_hp_below is not None:
                if hp_pct is None or hp_pct * 100.0 >= rule.when_hp_below:
                    continue
            if rule.when_mp_below is not None:
                if mp_pct is None or mp_pct * 100.0 >= rule.when_mp_below:
                    continue

            ready.append(rule)
        return ready

    def mark(self, rule: AutoCastRule, now: float) -> None:
        """Kuralı tetiklenmiş sayar ve bir sonraki zamanını hesaplar."""
        if rule.every_s > 0:
            interval = apply_jitter(rule.every_s * 1000.0, rule.jitter_pct, self.rng) / 1000.0
        else:
            # Sadece koşullu kural: art arda basmayı önlemek için kısa bir kilit.
            interval = 1.0
        self._next_due[rule.name] = now + interval
        log.debug("autocast %s tetiklendi, sıradaki %.1fs sonra", rule.name, interval)

    def remaining(self, rule: AutoCastRule, now: float) -> float:
        """Kuralın tetiklenmesine kalan süre."""
        return max(0.0, self._next_due.get(rule.name, now) - now)
