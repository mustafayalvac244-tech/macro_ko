"""Tuş adları — Leonardo firmware'i ile paylaşılan tek kaynak.

`arduino/ko_hid_bridge/ko_hid_bridge.ino` içindeki KEY_TABLE ile birebir aynı
isimleri kullanır; `tests/test_keys.py` iki tarafın senkron kaldığını doğrular.
"""

from __future__ import annotations

import string

#: Firmware'in adıyla tanıdığı özel tuşlar.
NAMED_KEYS: frozenset[str] = frozenset(
    {
        "tab", "esc", "enter", "space", "backspace", "delete",
        "insert", "home", "end", "pageup", "pagedown",
        "up", "down", "left", "right",
        "lshift", "rshift", "lctrl", "rctrl", "lalt", "ralt",
        *(f"f{i}" for i in range(1, 13)),
        *(f"numpad{i}" for i in range(10)),
        "numpadenter", "numpadplus", "numpadminus",
    }
)

#: Tek karakterlik tuşlar doğrudan ASCII olarak gönderilir.
CHAR_KEYS: frozenset[str] = frozenset(string.ascii_lowercase + string.digits + "-=[];',./`\\")

MOUSE_BUTTONS: frozenset[str] = frozenset({"left", "right", "middle"})


class UnknownKeyError(ValueError):
    """Firmware'in tanımadığı bir tuş adı verildi."""


def normalize_key(name: str) -> str:
    """Tuş adını firmware'in beklediği biçime getirir.

    >>> normalize_key(" F1 ")
    'f1'
    >>> normalize_key("A")
    'a'
    """
    key = str(name).strip().lower()
    if key in NAMED_KEYS or key in CHAR_KEYS:
        return key
    # Sık yapılan yazımlar için küçük bir tolerans.
    aliases = {
        "escape": "esc", "return": "enter", "spacebar": "space",
        "ctrl": "lctrl", "shift": "lshift", "alt": "lalt",
        "pgup": "pageup", "pgdn": "pagedown", "pagedn": "pagedown",
        "del": "delete", "ins": "insert",
    }
    if key in aliases:
        return aliases[key]
    raise UnknownKeyError(f"bilinmeyen tuş adı: {name!r}")


def normalize_button(name: str) -> str:
    """Fare butonu adını doğrular."""
    button = str(name).strip().lower()
    if button in MOUSE_BUTTONS:
        return button
    raise UnknownKeyError(f"bilinmeyen fare butonu: {name!r}")
