"""Oturum bekçisi: makronun ne zaman durması gerektiğine karar verir.

Tek noktada saatlerce farm ederken en büyük risk makronun **boşa çalışması**:
öldün ama makro tuş basmaya devam ediyor, ışınlandın ama döngü dönüyor,
moblar bitmiş ama Tab'a basıp duruyor. Hem işe yaramaz hem göze batar.

Oyunun durumunu okumadığımız için "öldün" bilgisini doğrudan alamayız. Ama
gözlemleyebildiğimiz üç şey yeterince iyi bir yaklaşım veriyor:

* **Can sıfır kaldı** — birkaç okuma üst üste sıfırsa büyük ihtimalle öldün.
  Tek okumaya güvenmiyoruz; bar bir kare boyunca yanlış okunabilir.
* **Uzun süredir kill yok** — mob kalmamış, menzil dışına düşmüşsün ya da
  bir şey ters gitmiş.
* **Süre/kill sınırı doldu** — sen öyle istedin.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SessionLimits:
    """Oturumun ne zaman biteceğini belirleyen kurallar."""

    #: Bu kadar kill sonra dur. ``None`` = sınırsız.
    max_kills: int | None = None
    #: Bu kadar dakika sonra dur. ``None`` = sınırsız.
    max_minutes: float | None = None
    #: Bu kadar dakika kill gelmezse dur. ``None`` = kapalı.
    idle_minutes: float | None = 10.0
    #: Can bu yüzdenin altındayken ölü sayılır.
    death_hp_pct: float = 1.0
    #: Ölü saymak için gereken üst üste okuma sayısı.
    death_reads: int = 5
    #: Ölüm tespitinde dursun mu?
    stop_on_death: bool = True

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SessionLimits":
        raw = raw or {}

        def optional(name: str, default):
            value = raw.get(name, default)
            return None if value in (None, 0, False) else float(value)

        limits = cls(
            max_kills=int(raw["max_kills"]) if raw.get("max_kills") else None,
            max_minutes=optional("max_minutes", None),
            idle_minutes=optional("idle_minutes", 10.0),
            death_hp_pct=float(raw.get("death_hp_pct", 1.0)),
            death_reads=int(raw.get("death_reads", 5)),
            stop_on_death=bool(raw.get("stop_on_death", True)),
        )
        if limits.death_reads < 1:
            raise ValueError("death_reads en az 1 olmalı")
        if not 0 <= limits.death_hp_pct <= 100:
            raise ValueError("death_hp_pct 0-100 arasında olmalı")
        return limits


@dataclass
class SessionGuard:
    """Sayaçları tutar ve durma sebebini bildirir."""

    limits: SessionLimits = field(default_factory=SessionLimits)

    kills: int = field(default=0, init=False)
    started_at: float = field(default=0.0, init=False)
    last_kill_at: float = field(default=0.0, init=False)
    reason: str | None = field(default=None, init=False)
    _low_hp_reads: int = field(default=0, init=False)

    def start(self, now: float) -> None:
        """Oturumu başlatır ve sayaçları sıfırlar."""
        self.kills = 0
        self.started_at = now
        self.last_kill_at = now
        self.reason = None
        self._low_hp_reads = 0

    def note_kill(self, now: float) -> None:
        """Bir kill kaydeder."""
        self.kills += 1
        self.last_kill_at = now

    def check(self, now: float, hp_pct: float | None = None) -> str | None:
        """Durma sebebini döndürür; devam edilecekse ``None``.

        Bir kez sebep oluştuktan sonra aynı sebep saklanır — döngü durduktan
        sonra tekrar tekrar hesaplanmasın diye.
        """
        if self.reason is not None:
            return self.reason

        limits = self.limits

        if limits.stop_on_death and hp_pct is not None:
            if hp_pct * 100.0 <= limits.death_hp_pct:
                self._low_hp_reads += 1
                if self._low_hp_reads >= limits.death_reads:
                    self.reason = "öldün (can sıfır)"
                    return self.reason
            else:
                # Tek yanlış okuma ölüm saydırmasın.
                self._low_hp_reads = 0

        if limits.max_kills is not None and self.kills >= limits.max_kills:
            self.reason = f"kill sınırı doldu ({limits.max_kills})"
            return self.reason

        if limits.max_minutes is not None:
            elapsed = (now - self.started_at) / 60.0
            if elapsed >= limits.max_minutes:
                self.reason = f"süre doldu ({limits.max_minutes:.0f} dk)"
                return self.reason

        if limits.idle_minutes is not None:
            idle = (now - self.last_kill_at) / 60.0
            if idle >= limits.idle_minutes:
                self.reason = f"{limits.idle_minutes:.0f} dakikadır kill yok"
                return self.reason

        return None

    @property
    def stopped(self) -> bool:
        return self.reason is not None

    def idle_seconds(self, now: float) -> float:
        """Son kill'den bu yana geçen süre."""
        return max(0.0, now - self.last_kill_at)
