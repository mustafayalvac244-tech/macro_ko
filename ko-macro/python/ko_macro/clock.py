"""Zaman soyutlaması.

Farm döngüsü ve doğuş tahmincisi doğrudan `time` çağırmaz; böylece testler
saati ileri sararak saniyelerce beklemeden çalışabilir.
"""

from __future__ import annotations

import threading
import time
from typing import Protocol


class Clock(Protocol):
    def monotonic(self) -> float:
        """Geriye gitmeyen saniye cinsinden sayaç."""

    def wall(self) -> float:
        """Unix epoch saniyesi (kayıtlara yazmak için)."""

    def sleep(self, seconds: float) -> None:
        """Verilen süre kadar bekler."""


class RealClock:
    """Gerçek zaman. `stop_event` verilirse uyku kesilebilir olur."""

    def __init__(self, stop_event: threading.Event | None = None) -> None:
        self._stop_event = stop_event

    def monotonic(self) -> float:
        return time.monotonic()

    def wall(self) -> float:
        return time.time()

    def sleep(self, seconds: float) -> None:
        if seconds <= 0:
            return
        if self._stop_event is not None:
            # Durdurma sinyali gelirse beklemeyi hemen kes.
            self._stop_event.wait(seconds)
        else:
            time.sleep(seconds)


class FakeClock:
    """Test saati: `sleep` gerçekten beklemez, sayacı ileri sarar."""

    def __init__(self, start: float = 1_700_000_000.0) -> None:
        self._wall = start
        self._mono = 0.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self._mono

    def wall(self) -> float:
        return self._wall

    def sleep(self, seconds: float) -> None:
        if seconds <= 0:
            return
        self.slept.append(seconds)
        self.advance(seconds)

    def advance(self, seconds: float) -> None:
        self._mono += seconds
        self._wall += seconds
