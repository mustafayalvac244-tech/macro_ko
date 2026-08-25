"""Dosya yolları — hem kaynak koddan hem .exe içinden çalışsın diye.

PyInstaller ile paketlendiğinde iki farklı klasör var:

* **Kaynak klasörü** (``resource_dir``): exe'nin içine gömülü dosyalar
  (profiller). Çalışırken geçici bir dizine açılır, ``sys._MEIPASS``.
* **Uygulama klasörü** (``app_dir``): exe'nin yanındaki klasör. Kullanıcının
  ``config.yaml`` ve ``spawns.json`` dosyaları buraya yazılır — geçici dizine
  yazılsa her açılışta silinirdi.
"""

from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent


def is_frozen() -> bool:
    """PyInstaller ile paketlenmiş exe içinde miyiz?"""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def resource_dir() -> Path:
    """Programla birlikte gelen salt-okunur dosyaların kökü."""
    if is_frozen():
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return PACKAGE_ROOT.parent


def app_dir() -> Path:
    """Kullanıcı dosyalarının (config, kayıtlar) durduğu klasör."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path.cwd()


def profile_dir() -> Path:
    """Hazır sınıf profillerinin klasörü."""
    return resource_dir() / "profiles"


def find_user_file(name: str) -> Path:
    """Kullanıcı dosyasını önce çalışılan klasörde, sonra exe yanında arar.

    Dosya hiçbir yerde yoksa exe'nin yanındaki yol döner — hata mesajı da
    kullanıcının bakması gereken yeri göstersin diye.
    """
    candidate = Path(name)
    if candidate.is_absolute():
        return candidate
    if candidate.is_file():
        return candidate.resolve()
    beside_app = app_dir() / name
    if beside_app.is_file():
        return beside_app
    return beside_app
