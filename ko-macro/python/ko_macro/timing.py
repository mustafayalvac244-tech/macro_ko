"""Zamanlama yardımcıları.

Ayrı bir modülde duruyor çünkü hem combo motoru hem otomatik yetenekler
kullanıyor ve ikisi birbirini import edemez.
"""

from __future__ import annotations

import random


def apply_jitter(value_ms: float, pct: float, rng: random.Random) -> int:
    """Süreye ``±pct`` oranında rastgelelik katar.

    Sabit milisaniye aralıkları hem oyunun cast ritmine oturmaz hem de
    gereksiz mekanik olur. Sonuç hiçbir zaman 0'ın altına düşmez; ``pct`` 0
    ise değer aynen döner.

    >>> apply_jitter(100, 0, random.Random(0))
    100
    """
    if pct <= 0 or value_ms <= 0:
        return int(round(value_ms))
    spread = value_ms * (pct / 100.0)
    return max(0, int(round(value_ms + rng.uniform(-spread, spread))))
