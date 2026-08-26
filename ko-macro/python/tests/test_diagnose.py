"""Tanılama ve Windows betiklerinin bütünlüğü."""

from __future__ import annotations

from pathlib import Path

import pytest

from ko_macro import diagnose

REPO = Path(__file__).resolve().parents[3]


def test_report_renders_every_section():
    report = diagnose.Report()
    good = report.add(diagnose.Section("iyi", ok=True))
    good.add("bir satır")
    bad = report.add(diagnose.Section("kötü", ok=False, hint="şunu yap"))
    report.add(diagnose.Section("bilgi"))

    lines = report.render().splitlines()
    assert "[OK]" in lines[0] and lines[0].endswith("iyi")
    assert lines[1].strip() == "bir satır"
    assert "[HATA]" in lines[3] and lines[3].endswith("kötü")
    assert lines[4].strip() == "-> şunu yap"
    assert "[bilgi]" in lines[6] and lines[6].endswith("bilgi")

    # Başlıklar tek sütunda hizalanmalı, yoksa rapor okunmuyor.
    headers = (lines[0], lines[3], lines[6])
    assert len({line.rindex(" ") for line in headers}) == 1


def test_blocking_lists_only_failures():
    report = diagnose.Report()
    report.add(diagnose.Section("a", ok=True))
    report.add(diagnose.Section("b", ok=False))
    report.add(diagnose.Section("c"))
    assert [s.name for s in report.blocking] == ["b"]


def test_collect_runs_everywhere():
    """Donanım yokken bile çökmemeli — rapor zaten 'yok' demek için var."""
    report = diagnose.collect()
    names = [s.name for s in report.sections]
    assert names == [
        "Sistem",
        "USB / seri port",
        "Firmware",
        "Ekran okuma",
        "Fare ivmesi",
        "Oyun penceresi",
        "Ayarlar",
    ]
    report.render()  # biçimlendirme her durumda çalışsın


@pytest.mark.parametrize("which", diagnose.CHECKS)
def test_check_one_returns_a_section(which):
    section = diagnose.check_one(which)
    assert isinstance(section, diagnose.Section)


def test_check_one_rejects_unknown():
    with pytest.raises(ValueError):
        diagnose.check_one("yok")


def test_write_places_report_beside_app(tmp_path, monkeypatch):
    monkeypatch.setattr(diagnose, "app_dir", lambda: tmp_path)
    report = diagnose.Report()
    report.add(diagnose.Section("x", ok=True))
    path = Path(diagnose.write(report))
    assert path.parent == tmp_path
    assert "ko-macro tanılama" in path.read_text(encoding="utf-8")


# --- Windows betikleri ------------------------------------------------------


WINDOWS_SCRIPTS = [
    REPO / "ko-macro/python/baslat.bat",
    REPO / "ko-macro/python/derle.bat",
    REPO / "ko-macro/arduino/yukle.bat",
    REPO / "ko-macro/arduino/yukle.ps1",
]


@pytest.mark.parametrize("script", WINDOWS_SCRIPTS, ids=lambda p: p.name)
def test_windows_scripts_use_crlf(script):
    """LF satır sonlu bir .bat'ta cmd.exe goto hedefini bulamaz."""
    raw = script.read_bytes()
    assert raw.count(b"\n") > 0
    assert raw.count(b"\r\n") == raw.count(b"\n"), f"{script.name} CRLF değil"


def test_launcher_targets_exist():
    """baslat.bat'ın çağırdığı her komut gerçekten var mı?"""
    from ko_macro.cli import build_parser

    text = (REPO / "ko-macro/python/baslat.bat").read_text(encoding="utf-8")
    parser = build_parser()
    commands: set[str] = set()
    for action in parser._subparsers._group_actions:  # type: ignore[union-attr]
        commands.update(action.choices or {})

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("ko-macro.exe "):
            command = stripped.split()[1]
            assert command in commands, f"baslat.bat bilinmeyen komut çağırıyor: {command}"


def test_launcher_goto_targets_are_defined():
    """Tanımsız bir etikete atlarsa betik hata verip kapanır."""
    text = (REPO / "ko-macro/python/baslat.bat").read_text(encoding="utf-8")
    labels = {
        line.strip()[1:].lower()
        for line in text.splitlines()
        if line.strip().startswith(":") and not line.strip().startswith("::")
    }
    targets = {
        line.strip().split("goto", 1)[1].strip().lstrip(":").lower()
        for line in text.splitlines()
        if "goto" in line.lower() and line.strip().lower().startswith(("goto", "if", ")"))
    }
    missing = targets - labels
    assert not missing, f"tanımsız etiket: {missing}"
