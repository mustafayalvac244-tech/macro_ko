"""Global kısayol yönetimi.

``keyboard`` paketi varsa gerçek global hook kurulur (Windows'ta oyun
penceresi öndeyken de çalışır). Yoksa kısayollar devre dışı kalır ve
komutlar konsoldan verilir.

Dikkat: Leonardo gerçek bir USB klavye gibi davrandığı için makronun bastığı
tuşları bu hook da görür. Bu yüzden kısayolları combo içinde kullanılan
tuşlara bağlama — sonsuz tetiklenme olur. :class:`~ko_macro.runtime.MacroEngine`
ayrıca combo çalışırken gelen kısayolları yok sayar.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable

log = logging.getLogger(__name__)

#: Bizim tuş adlarımızdan ``keyboard`` paketinin adlandırmasına.
_KEYBOARD_ALIASES = {
    "lctrl": "left ctrl", "rctrl": "right ctrl",
    "lshift": "left shift", "rshift": "right shift",
    "lalt": "left alt", "ralt": "right alt",
    "pageup": "page up", "pagedown": "page down",
    "numpadenter": "enter", "numpadplus": "plus", "numpadminus": "minus",
}


def to_keyboard_name(key: str) -> str:
    """Tuş adını ``keyboard`` paketinin beklediği biçime çevirir."""
    if key.startswith("numpad") and key[6:].isdigit():
        return key[6:]
    return _KEYBOARD_ALIASES.get(key, key)


class HotkeyError(RuntimeError):
    """Kısayol kaydedilemedi."""


@dataclass
class HotkeyManager:
    """Kısayolları kaydeder ve geri çağırır."""

    bindings: dict[str, Callable[[], None]] = field(default_factory=dict)
    _backend: object | None = field(default=None, init=False, repr=False)
    _handles: list[object] = field(default_factory=list, init=False, repr=False)
    active: bool = field(default=False, init=False)

    def register(self, key: str, callback: Callable[[], None]) -> None:
        """Bir kısayolu bağlar (henüz dinlemeye başlamaz)."""
        if key in self.bindings:
            raise HotkeyError(f"bu kısayol zaten kullanımda: {key}")
        self.bindings[key] = callback

    @staticmethod
    def available() -> bool:
        """``keyboard`` paketi kurulu mu?"""
        try:
            import keyboard  # noqa: F401
        except Exception:
            return False
        return True

    def start(self) -> bool:
        """Dinlemeye başlar. Paket yoksa ``False`` döner."""
        try:
            import keyboard
        except Exception as exc:  # ImportError ya da izin hatası
            log.warning(
                "global kısayollar devre dışı (%s). Komutları konsoldan verebilirsin.", exc
            )
            return False

        self._backend = keyboard
        for key, callback in self.bindings.items():
            try:
                handle = keyboard.add_hotkey(to_keyboard_name(key), callback, suppress=False)
            except Exception as exc:
                log.warning("kısayol bağlanamadı (%s): %s", key, exc)
                continue
            self._handles.append(handle)
        self.active = bool(self._handles)
        if self.active:
            log.info("kısayollar aktif: %s", ", ".join(sorted(self.bindings)))
        return self.active

    def stop(self) -> None:
        """Tüm kısayolları kaldırır."""
        backend = self._backend
        if backend is None:
            return
        for handle in self._handles:
            try:
                backend.remove_hotkey(handle)  # type: ignore[attr-defined]
            except Exception:  # pragma: no cover - paket içi durum
                pass
        self._handles.clear()
        self.active = False
