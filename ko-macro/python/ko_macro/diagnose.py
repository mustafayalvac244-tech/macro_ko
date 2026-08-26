"""Tanılama — bu bilgisayarda neyin çalışıp neyin çalışmadığını toplar.

Makronun oyuna tuş gönderebilmesi bir zincire bağlı: kablo → seri port →
firmware → ekran okuma → oyun penceresi. Zincir koptuğunda kullanıcının
gördüğü tek şey "çalışmıyor" oluyor; bu modül kopan halkayı adıyla söyler
ve hepsini tek dosyaya yazar, böylece dışarıdan bakan biri de okuyabilir.

Windows'a özgü çağrılar içeri alınırken korunuyor: modül her yerde import
edilebilsin ve testler Linux'ta koşabilsin diye.
"""

from __future__ import annotations

import platform
import sys
from dataclasses import dataclass, field
from datetime import datetime

from . import __version__
from .paths import app_dir, find_user_file, is_frozen

#: Bir bölümün sonucu. ``ok=None`` => yargı yok, sadece bilgi.
Verdict = bool | None


@dataclass
class Section:
    """Tanılama raporunun tek bir başlığı."""

    name: str
    ok: Verdict = None
    lines: list[str] = field(default_factory=list)
    hint: str | None = None

    def add(self, line: str) -> None:
        self.lines.append(line)


@dataclass
class Report:
    """Bütün bölümler."""

    sections: list[Section] = field(default_factory=list)

    def add(self, section: Section) -> Section:
        self.sections.append(section)
        return section

    @property
    def blocking(self) -> list[Section]:
        """Kırmızı bölümler — bunlar düzelmeden makro çalışmaz."""
        return [s for s in self.sections if s.ok is False]

    def render(self) -> str:
        # Etiketler aynı genişlikte olsun ki başlıklar tek sütunda hizalansın.
        marks = {True: "[OK]   ", False: "[HATA] ", None: "[bilgi]"}
        out: list[str] = []
        for section in self.sections:
            out.append(f"{marks[section.ok]} {section.name}")
            for line in section.lines:
                out.append(f"        {line}")
            if section.hint:
                out.append(f"        -> {section.hint}")
            out.append("")
        return "\n".join(out).rstrip() + "\n"


# --------------------------------------------------------------- tek tek testler


def _system(report: Report) -> None:
    section = report.add(Section("Sistem"))
    section.add(f"ko-macro {__version__}  ({'exe' if is_frozen() else 'kaynak'})")
    section.add(f"{platform.system()} {platform.release()} ({platform.machine()})")
    section.add(f"Python {sys.version.split()[0]}")
    section.add(f"klasör: {app_dir()}")
    section.add(f"yönetici: {_admin_state()}")


def _admin_state() -> str:
    """Yönetici olarak mı çalışıyoruz? Kısayolların oyunda çalışması buna bağlı."""
    if platform.system() != "Windows":
        return "Windows değil"
    try:
        import ctypes

        return "evet" if ctypes.windll.shell32.IsUserAnAdmin() else "HAYIR"
    except Exception as exc:  # pragma: no cover - Windows'a özgü
        return f"okunamadı ({exc})"


def _ports(report: Report) -> list[tuple[str, str]]:
    """Bağlı seri portlar; Leonardo'ya benzeyenler ayrıca işaretlenir."""
    from .transport import SerialHidTransport, TransportError

    section = report.add(Section("USB / seri port"))
    try:
        from serial.tools import list_ports

        every = list(list_ports.comports())
    except Exception as exc:
        section.ok = False
        section.add(f"port listesi alınamadı: {exc}")
        return []

    if not every:
        section.add("bilgisayarda hiç seri port yok")
    for info in every:
        vid, pid = getattr(info, "vid", None), getattr(info, "pid", None)
        ident = f"VID:PID={vid:04X}:{pid:04X}" if vid and pid else "kimlik yok"
        section.add(f"{info.device}  {info.description}  {ident}")

    try:
        matches = SerialHidTransport.discover_ports()
    except TransportError as exc:
        section.ok = False
        section.add(str(exc))
        return []

    if matches:
        section.ok = True
        section.add(f"Leonardo gibi görünen: {', '.join(p for p, _ in matches)}")
    else:
        section.ok = False
        section.hint = (
            "Kart görünmüyor. Sık nedenler: kablo sadece şarj kablosu (veri "
            "taşımıyor), firmware hiç yüklenmemiş, ya da Arduino IDE'nin Serial "
            "Monitor'ü portu kilitlemiş."
        )
    return matches


def _firmware(report: Report, matches: list[tuple[str, str]]) -> None:
    """Karta bağlanıp sürüm sorar. Asıl kanıt bu: kart cevap veriyor mu?"""
    section = report.add(Section("Firmware"))
    if not matches:
        section.ok = False
        section.add("kart bulunamadığı için denenmedi")
        section.hint = "Önce yukarıdaki port sorununu çöz."
        return

    from .transport import SerialHidTransport, TransportError

    port = matches[0][0]
    transport = SerialHidTransport(port=port)
    try:
        transport.connect()
    except TransportError as exc:
        section.ok = False
        section.add(f"{port}: {exc}")
        section.hint = (
            "Kart görünüyor ama cevap vermiyor — büyük ihtimalle firmware "
            "yüklenmemiş. firmware\\yukle.bat dosyasını çalıştır."
        )
        return
    except Exception as exc:  # beklenmedik sürücü hataları da rapora girsin
        section.ok = False
        section.add(f"{port}: beklenmedik hata: {exc}")
        return

    section.ok = True
    section.add(f"{port}: bağlandı, sürüm sorgusuna cevap verdi")
    section.add("kart tuş göndermeye hazır")
    try:
        transport.close()
    except Exception:
        pass


def _screen(report: Report) -> None:
    """Ekran yakalama olmadan can barı, hedef barı, mob adı okunamaz."""
    section = report.add(Section("Ekran okuma"))
    try:
        import mss
    except ImportError:
        section.ok = False
        section.add("mss kurulu değil")
        section.hint = "Exe'yi kullanıyorsan bu olmamalı; paketi yeniden indir."
        return

    try:
        with mss.mss() as sct:
            monitors = sct.monitors[1:]
    except Exception as exc:
        section.ok = False
        section.add(f"ekran yakalanamadı: {exc}")
        section.hint = "Uzak masaüstünden bağlıysan ekran okunmaz; makineye fiziksel otur."
        return

    section.ok = True
    for index, monitor in enumerate(monitors, start=1):
        section.add(
            f"ekran {index}: {monitor['width']}x{monitor['height']} "
            f"@ ({monitor['left']},{monitor['top']})"
        )


def _mouse_accel(report: Report) -> None:
    """İvme açıkken göreli fare hareketi hedefi tutturamaz."""
    section = report.add(Section("Fare ivmesi"))
    if platform.system() != "Windows":
        section.add("Windows değil, atlandı")
        return
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Control Panel\Mouse") as key:
            speed = winreg.QueryValueEx(key, "MouseSpeed")[0]
    except Exception as exc:  # pragma: no cover - Windows'a özgü
        section.add(f"okunamadı: {exc}")
        return

    if str(speed) == "0":
        section.ok = True
        section.add("kapalı — imleç konumlandırma doğru çalışır")
    else:
        section.ok = False
        section.add(f"AÇIK (MouseSpeed={speed})")
        section.hint = (
            "Denetim Masası > Fare > İşaretçi Seçenekleri > 'İşaretçi hassaslığını "
            "artır' kutusunun işaretini kaldır. Açık kaldığı sürece etikete tıklama "
            "kipi ıskalar."
        )


def _windows(report: Report) -> None:
    """Oyun açık mı? Açık değilse kalibrasyon anlamsız."""
    section = report.add(Section("Oyun penceresi"))
    if platform.system() != "Windows":
        section.add("Windows değil, atlandı")
        return
    try:
        titles = _visible_window_titles()
    except Exception as exc:  # pragma: no cover - Windows'a özgü
        section.add(f"pencereler listelenemedi: {exc}")
        return

    hits = [t for t in titles if "knight" in t.lower() or "knightonline" in t.lower()]
    if hits:
        section.ok = True
        for title in hits:
            section.add(f"bulundu: {title}")
    else:
        section.ok = False
        section.add(f"{len(titles)} açık pencere var, adında 'Knight' geçen yok")
        section.hint = "Oyunu aç ve tanılamayı tekrar çalıştır."


def _visible_window_titles() -> list[str]:  # pragma: no cover - Windows'a özgü
    """Görünür ve başlığı olan pencerelerin adları."""
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    titles: list[str] = []

    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def collect(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length:
            buffer = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buffer, length + 1)
            titles.append(buffer.value)
        return True

    user32.EnumWindows(callback_type(collect), 0)
    return titles


def _config(report: Report, config_path: str = "config.yaml") -> None:
    """Ayar dosyası var mı, okunuyor mu, ekrana bağlı kısımları dolu mu?"""
    section = report.add(Section("Ayarlar"))
    path = find_user_file(config_path)
    if not path.is_file():
        section.ok = False
        section.add(f"{path} yok")
        section.hint = "Program ilk açılışta oluşturur; baslat.bat'ı çalıştır."
        return

    section.add(f"dosya: {path}")
    try:
        from .config import load_config

        config = load_config(path)
    except Exception as exc:
        section.ok = False
        section.add(f"okunamadı: {exc}")
        section.hint = "Dosyayı sil, program varsayılanı yeniden yazsın."
        return

    section.ok = True
    section.add(f"profil: {config.profile_name or '-'}   combo sayısı: {len(config.combos)}")
    section.add(f"cihaz kipi: {config.transport.kind}")
    vitals = config.vitals
    section.add(f"can barı okuma: {'açık' if vitals and vitals.enabled else 'kapalı'}")
    farm = config.farm
    section.add(f"farm döngüsü: {'açık' if farm and farm.enabled else 'kapalı'}")
    if farm and farm.enabled and not farm.target_bar:
        section.add("uyarı: hedef barı tanımsız — mobun öldüğü an anlaşılamaz")


# --------------------------------------------------------------------- toplayıcı


def collect(config_path: str = "config.yaml") -> Report:
    """Bütün testleri sırayla koşturur."""
    report = Report()
    _system(report)
    matches = _ports(report)
    _firmware(report, matches)
    _screen(report)
    _mouse_accel(report)
    _windows(report)
    _config(report, config_path)
    return report


#: ``check_one`` için kısa adlar. Betiklerin tek bir halkayı sorabilmesi için.
CHECKS = ("port", "firmware", "ekran", "fare", "oyun", "ayar")


def check_one(which: str, config_path: str = "config.yaml") -> Section:
    """Tek bir halkayı dener. Betikler bunun sonucuna göre dallanabilsin diye."""
    if which not in CHECKS:
        raise ValueError(f"bilinmeyen kontrol: {which} (seçenekler: {', '.join(CHECKS)})")

    report = Report()
    if which in ("port", "firmware"):
        matches = _ports(report)
        if which == "port":
            return report.sections[-1]
        _firmware(report, matches)
    elif which == "ekran":
        _screen(report)
    elif which == "fare":
        _mouse_accel(report)
    elif which == "oyun":
        _windows(report)
    else:
        _config(report, config_path)
    return report.sections[-1]


def write(report: Report, name: str = "tanilama.txt") -> str:
    """Raporu exe'nin yanına yazar ve yolunu döndürür."""
    path = app_dir() / name
    header = f"ko-macro tanılama — {datetime.now():%Y-%m-%d %H:%M:%S}\n" + "=" * 60 + "\n\n"
    path.write_text(header + report.render(), encoding="utf-8")
    return str(path)
