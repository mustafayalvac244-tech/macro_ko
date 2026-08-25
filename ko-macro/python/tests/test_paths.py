"""Yol çözümlemesi — hem kaynak koddan hem paketlenmiş exe içinden.

PyInstaller ile paketlendiğinde profiller geçici bir dizine açılır
(``sys._MEIPASS``), kullanıcı dosyaları ise exe'nin yanında durmalıdır.
Bu ayrım bozulursa exe her açılışta ayarları unutur.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from ko_macro import paths


@pytest.fixture
def frozen(tmp_path, monkeypatch):
    """Paketlenmiş exe ortamını taklit eder."""
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    exe_dir = tmp_path / "yanindaki"
    exe_dir.mkdir()

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(bundle), raising=False)
    monkeypatch.setattr(sys, "executable", str(exe_dir / "ko-macro.exe"), raising=False)
    return bundle, exe_dir


def test_not_frozen_by_default():
    assert paths.is_frozen() is False


def test_source_layout_finds_profiles():
    # Kaynak koddan çalışırken profiles/ paketin yanındadır.
    assert paths.profile_dir().is_dir()
    assert (paths.profile_dir() / "archer.yaml").is_file()


def test_frozen_resources_come_from_bundle(frozen):
    bundle, _ = frozen
    assert paths.is_frozen() is True
    assert paths.resource_dir() == bundle
    assert paths.profile_dir() == bundle / "profiles"


def test_frozen_user_files_live_next_to_the_exe(frozen):
    _, exe_dir = frozen
    # Kullanıcı dosyaları geçici pakete DEĞİL, exe'nin yanına yazılmalı.
    assert paths.app_dir() == exe_dir
    assert paths.find_user_file("config.yaml") == exe_dir / "config.yaml"


def test_find_user_file_prefers_working_directory(frozen, tmp_path, monkeypatch):
    _, exe_dir = frozen
    work = tmp_path / "calisilan"
    work.mkdir()
    (work / "config.yaml").write_text("profile: archer\n", encoding="utf-8")
    monkeypatch.chdir(work)

    # Bulunduğun klasörde bir config varsa o kazanır.
    assert paths.find_user_file("config.yaml") == (work / "config.yaml").resolve()


def test_find_user_file_keeps_absolute_paths(tmp_path):
    target = tmp_path / "baska" / "config.yaml"
    assert paths.find_user_file(str(target)) == target


def test_find_user_file_returns_app_path_when_missing(frozen):
    _, exe_dir = frozen
    # Dosya yoksa bile exe yanındaki yol dönmeli ki hata mesajı doğru yeri
    # göstersin ve oraya yazılabilsin.
    assert paths.find_user_file("yok.yaml") == exe_dir / "yok.yaml"


def test_app_dir_is_cwd_when_not_frozen(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert paths.app_dir() == Path(tmp_path)
