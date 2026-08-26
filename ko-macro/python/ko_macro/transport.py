"""Tuş/fare olaylarını dışarı veren taşıma katmanları.

Üç uygulama var:

* :class:`SerialHidTransport` — Arduino Leonardo'ya seri porttan komut yollar,
  tuşa Leonardo basar. Oyun açısından gerçek bir USB klavyeden farkı yoktur.
* :class:`SoftwareTransport` — Leonardo yokken Windows'ta ``pydirectinput`` ile
  yazılımsal tuş gönderir.
* :class:`DryRunTransport` — hiçbir şey göndermez, sadece kaydeder. Testler ve
  ``--dry-run`` için.
"""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from .keys import normalize_button, normalize_key

log = logging.getLogger(__name__)

#: Leonardo ve klonlarının USB kimlikleri (VID, PID). PID=None => tüm ürünler.
LEONARDO_IDS: tuple[tuple[int, int | None], ...] = (
    (0x2341, 0x8036),  # Arduino Leonardo
    (0x2341, 0x0036),  # Leonardo bootloader
    (0x2A03, 0x8036),  # Arduino.org Leonardo
    (0x2341, 0x8037),  # Micro (aynı firmware çalışır)
    (0x1B4F, None),    # SparkFun Pro Micro
)


#: İmleci köşeye dayamak için gönderilen toplam göreli hareket. Ekranın
#: köşegeninden büyük olmalı ki imleç kesin köşeye otursun.
MOUSE_HOME_TRAVEL = 4000


class TransportError(RuntimeError):
    """Cihaz bulunamadı, cevap vermedi ya da hata döndürdü."""


@dataclass(frozen=True)
class QueuedStep:
    """Combo kuyruğundaki tek adım."""

    is_mouse: bool
    target: str
    hold_ms: int
    gap_ms: int
    #: tap = bas-bırak, hold = basılı bırak, release = bırak
    action: str = "tap"


class Transport(ABC):
    """Ortak arayüz. Tüm süreler milisaniyedir."""

    name = "transport"

    #: Cihaz combo dizisini kendi saatiyle çalıştırabiliyor mu?
    supports_burst = False

    def connect(self) -> None:
        """Cihazı hazırlar. Varsayılan: yapacak bir şey yok."""

    def close(self) -> None:
        """Kaynakları serbest bırakır."""

    def arm(self) -> None:
        """HID çıkışını açar."""

    def disarm(self) -> None:
        """HID çıkışını kapatır ve basılı kalan her şeyi bırakır."""

    def heartbeat(self) -> None:
        """Uzun beklemelerde watchdog'u besler."""

    @abstractmethod
    def tap(self, key: str, hold_ms: int = 45) -> None: ...

    @abstractmethod
    def key_down(self, key: str) -> None: ...

    @abstractmethod
    def key_up(self, key: str) -> None: ...

    @abstractmethod
    def click(self, button: str = "left", hold_ms: int = 45) -> None: ...

    @abstractmethod
    def mouse_down(self, button: str = "left") -> None: ...

    @abstractmethod
    def mouse_up(self, button: str = "left") -> None: ...

    @abstractmethod
    def mouse_move(self, dx: int, dy: int) -> None: ...

    @abstractmethod
    def release_all(self) -> None: ...

    # -- combo kuyruğu -----------------------------------------------------
    #
    # Leonardo bunu firmware tarafında çalıştırır (adımlar arası zamanlama
    # PC'ye bağlı olmaz). Diğer taşıma katmanları aynı arayüzü tek tek tuşa
    # basarak taklit eder.

    @property
    def _steps(self) -> list[QueuedStep]:
        steps = getattr(self, "_step_list", None)
        if steps is None:
            steps = []
            self._step_list = steps
        return steps

    def queue_clear(self) -> None:
        self._steps.clear()

    def queue_key(self, key: str, hold_ms: int = 45, gap_ms: int = 0) -> None:
        self._steps.append(QueuedStep(False, normalize_key(key), int(hold_ms), int(gap_ms)))

    def queue_key_down(self, key: str, gap_ms: int = 0) -> None:
        """Tuşu basılı bırakan adım — sonraki adımlar o tuş basılıyken çalışır."""
        self._steps.append(
            QueuedStep(False, normalize_key(key), 0, int(gap_ms), action="hold")
        )

    def queue_key_up(self, key: str, gap_ms: int = 0) -> None:
        """Basılı tutulan tuşu bırakan adım."""
        self._steps.append(
            QueuedStep(False, normalize_key(key), 0, int(gap_ms), action="release")
        )

    def queue_click(self, button: str = "left", hold_ms: int = 45, gap_ms: int = 0) -> None:
        self._steps.append(QueuedStep(True, normalize_button(button), int(hold_ms), int(gap_ms)))

    def run_queue(self, repeat: int = 1) -> int:
        """Kuyruğu çalıştırır, uygulanan adım sayısını döndürür."""
        executed = 0
        for _ in range(max(1, int(repeat))):
            for step in list(self._steps):
                if step.action == "hold":
                    self.key_down(step.target)
                elif step.action == "release":
                    self.key_up(step.target)
                elif step.is_mouse:
                    self.click(step.target, step.hold_ms)
                else:
                    self.tap(step.target, step.hold_ms)
                executed += 1
                if step.gap_ms > 0:
                    self._wait(step.gap_ms / 1000.0)
        return executed

    # -- mutlak konumlandırma ---------------------------------------------

    def mouse_home(self) -> None:
        """İmleci sol üst köşeye dayar.

        Leonardo'nun fare arayüzü **göreli**: "şu kadar sağa git" der, "şuraya
        git" diyemez. Mutlak konuma gitmenin yolu önce bilinen bir noktaya
        dayanmak; ekranın sol üstü de imlecin daha ileri gidemediği yer.
        """
        self.mouse_move(-MOUSE_HOME_TRAVEL, -MOUSE_HOME_TRAVEL)

    def mouse_to(self, x: int, y: int) -> None:
        """İmleci ekran koordinatına götürür (önce köşeye dayanarak).

        Windows'ta **"İşaretçi hassasiyetini artır"** kapalı olmalı: açıkken
        işletim sistemi göreli hareketi hıza göre ölçekler ve imleç
        hesapladığımız yere düşmez.
        """
        self.mouse_home()
        if x or y:
            self.mouse_move(int(x), int(y))

    def _wait(self, seconds: float) -> None:
        time.sleep(seconds)

    def abort(self) -> None:
        """Çalışan comboyu keser ve basılı kalanları bırakır."""
        self.release_all()

    def __enter__(self) -> "Transport":
        self.connect()
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()


# --------------------------------------------------------------------- kuru mod


@dataclass
class Action:
    """Kaydedilmiş tek bir giriş olayı."""

    kind: str
    target: str
    hold_ms: int = 0
    at: float = 0.0


class DryRunTransport(Transport):
    """Hiçbir tuşa basmaz; yapılacak olanı listeye yazar."""

    name = "dry-run"

    def __init__(self, log_actions: bool = False) -> None:
        self.actions: list[Action] = []
        self.armed = False
        self.log_actions = log_actions

    def _record(self, kind: str, target: str, hold_ms: int = 0) -> None:
        action = Action(kind=kind, target=target, hold_ms=hold_ms, at=time.monotonic())
        self.actions.append(action)
        if self.log_actions:
            log.info("[kuru] %s %s%s", kind, target, f" {hold_ms}ms" if hold_ms else "")

    def arm(self) -> None:
        self.armed = True

    def disarm(self) -> None:
        self.armed = False
        self._record("release_all", "*")

    def tap(self, key: str, hold_ms: int = 45) -> None:
        self._record("tap", normalize_key(key), hold_ms)

    def key_down(self, key: str) -> None:
        self._record("key_down", normalize_key(key))

    def key_up(self, key: str) -> None:
        self._record("key_up", normalize_key(key))

    def click(self, button: str = "left", hold_ms: int = 45) -> None:
        self._record("click", normalize_button(button), hold_ms)

    def mouse_down(self, button: str = "left") -> None:
        self._record("mouse_down", normalize_button(button))

    def mouse_up(self, button: str = "left") -> None:
        self._record("mouse_up", normalize_button(button))

    def mouse_move(self, dx: int, dy: int) -> None:
        self._record("mouse_move", f"{int(dx)},{int(dy)}")

    def release_all(self) -> None:
        self._record("release_all", "*")

    def _wait(self, seconds: float) -> None:
        # Kuru modda gerçekten beklemeyiz; süreyi kayda geçmek yeterli.
        self._record("wait", f"{int(round(seconds * 1000))}ms")


# ------------------------------------------------------------------- Leonardo


@dataclass
class SerialHidTransport(Transport):
    """Leonardo üzerindeki ``ko_hid_bridge`` firmware'ine seri komut yollar.

    Firmware ARMED iken 2 saniye komut görmezse kendini kapatır; bu yüzden
    arka planda 700 ms'de bir heartbeat gönderen bir iş parçacığı çalışır.
    """

    port: str | None = None
    baudrate: int = 115200
    timeout: float = 1.0
    heartbeat_interval: float = 0.7

    name: str = field(default="leonardo", init=False)
    _serial: object | None = field(default=None, init=False, repr=False)
    _lock: threading.RLock = field(default_factory=threading.RLock, init=False, repr=False)
    _armed: bool = field(default=False, init=False)
    _stop_heartbeat: threading.Event = field(default_factory=threading.Event, init=False, repr=False)
    _heartbeat_thread: threading.Thread | None = field(default=None, init=False, repr=False)

    # -- bağlantı ----------------------------------------------------------

    @staticmethod
    def discover_ports() -> list[tuple[str, str]]:
        """Leonardo'ya benzeyen portları ``(port, açıklama)`` olarak döndürür."""
        try:
            from serial.tools import list_ports
        except ImportError as exc:  # pragma: no cover - ortama bağlı
            raise TransportError("pyserial kurulu değil: pip install pyserial") from exc

        found: list[tuple[str, str]] = []
        for info in list_ports.comports():
            vid, pid = getattr(info, "vid", None), getattr(info, "pid", None)
            matches_id = any(
                vid == want_vid and (want_pid is None or pid == want_pid)
                for want_vid, want_pid in LEONARDO_IDS
            )
            description = f"{info.description or ''} {getattr(info, 'manufacturer', '') or ''}"
            matches_name = "leonardo" in description.lower() or "arduino" in description.lower()
            if matches_id or matches_name:
                found.append((info.device, description.strip() or "bilinmeyen"))
        return found

    def connect(self) -> None:
        try:
            import serial
        except ImportError as exc:  # pragma: no cover - ortama bağlı
            raise TransportError("pyserial kurulu değil: pip install pyserial") from exc

        port = self.port
        if not port:
            candidates = self.discover_ports()
            if not candidates:
                raise TransportError(
                    "Leonardo bulunamadı. Kabloyu kontrol et ya da config'de "
                    "transport.port değerini elle gir (örn. COM5)."
                )
            port = candidates[0][0]
            log.info("Leonardo bulundu: %s (%s)", port, candidates[0][1])

        try:
            self._serial = serial.Serial(port, self.baudrate, timeout=self.timeout)
        except Exception as exc:  # serial.SerialException ve alt türleri
            raise TransportError(f"{port} açılamadı: {exc}") from exc

        self.port = port
        time.sleep(1.8)  # Leonardo seri port açılınca yeniden numaralanıyor.
        self._drain()

        version = self._command("V", expect_prefix="VER")
        log.info("Firmware: %s", version)

    def _drain(self) -> None:
        serial_port = self._serial
        if serial_port is not None and hasattr(serial_port, "reset_input_buffer"):
            serial_port.reset_input_buffer()  # type: ignore[attr-defined]

    def close(self) -> None:
        self._stop_heartbeat.set()
        thread = self._heartbeat_thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=2.0)
        self._heartbeat_thread = None
        if self._serial is not None:
            try:
                if self._armed:
                    self._command("X", expect_prefix="DISARMED")
            except TransportError:
                pass  # Kapanışta cevap alamamak sorun değil, watchdog temizler.
            try:
                self._serial.close()  # type: ignore[attr-defined]
            finally:
                self._serial = None
        self._armed = False

    # -- protokol ----------------------------------------------------------

    def _command(self, line: str, expect_prefix: str = "OK") -> str:
        serial_port = self._serial
        if serial_port is None:
            raise TransportError("bağlantı yok: önce connect() çağır")

        with self._lock:
            try:
                serial_port.write((line + "\n").encode("ascii"))  # type: ignore[attr-defined]
                serial_port.flush()  # type: ignore[attr-defined]
                raw = serial_port.readline()  # type: ignore[attr-defined]
            except Exception as exc:
                raise TransportError(f"seri iletişim hatası ({line!r}): {exc}") from exc

        response = raw.decode("ascii", "replace").strip()
        if not response:
            raise TransportError(f"cihaz cevap vermedi: {line!r}")
        if response.startswith("ERR"):
            raise TransportError(f"cihaz hata döndü ({line!r}): {response}")
        if not response.startswith(expect_prefix):
            raise TransportError(f"beklenmeyen cevap ({line!r}): {response}")
        return response

    # -- durum -------------------------------------------------------------

    def arm(self) -> None:
        self._command("E", expect_prefix="ARMED")
        self._armed = True
        self._stop_heartbeat.clear()
        if self._heartbeat_thread is None or not self._heartbeat_thread.is_alive():
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_loop, name="ko-hid-heartbeat", daemon=True
            )
            self._heartbeat_thread.start()

    def disarm(self) -> None:
        self._stop_heartbeat.set()
        self._command("X", expect_prefix="DISARMED")
        self._armed = False

    def _heartbeat_loop(self) -> None:
        while not self._stop_heartbeat.wait(self.heartbeat_interval):
            try:
                self.heartbeat()
            except TransportError as exc:
                log.warning("heartbeat başarısız: %s", exc)
                return

    def heartbeat(self) -> None:
        if self._armed and self._serial is not None:
            self._command("P", expect_prefix="PONG")

    # -- giriş olayları ----------------------------------------------------

    def tap(self, key: str, hold_ms: int = 45) -> None:
        self._command(f"T {normalize_key(key)} {int(hold_ms)}")

    def key_down(self, key: str) -> None:
        self._command(f"D {normalize_key(key)}")

    def key_up(self, key: str) -> None:
        self._command(f"U {normalize_key(key)}")

    def click(self, button: str = "left", hold_ms: int = 45) -> None:
        self._command(f"C {normalize_button(button)} {int(hold_ms)}")

    def mouse_down(self, button: str = "left") -> None:
        self._command(f"MD {normalize_button(button)}")

    def mouse_up(self, button: str = "left") -> None:
        self._command(f"MU {normalize_button(button)}")

    def mouse_move(self, dx: int, dy: int) -> None:
        self._command(f"MV {int(dx)} {int(dy)}")

    def release_all(self) -> None:
        self._command("R", expect_prefix="RELEASED")

    # -- combo kuyruğu (firmware tarafında) --------------------------------

    supports_burst = True

    def queue_clear(self) -> None:
        self._steps.clear()
        self._command("QC")

    def queue_key(self, key: str, hold_ms: int = 45, gap_ms: int = 0) -> None:
        key = normalize_key(key)
        self._command(f"QK {key} {int(hold_ms)} {int(gap_ms)}")
        self._steps.append(QueuedStep(False, key, int(hold_ms), int(gap_ms)))

    def queue_key_down(self, key: str, gap_ms: int = 0) -> None:
        key = normalize_key(key)
        self._command(f"QD {key} {int(gap_ms)}")
        self._steps.append(QueuedStep(False, key, 0, int(gap_ms), action="hold"))

    def queue_key_up(self, key: str, gap_ms: int = 0) -> None:
        key = normalize_key(key)
        self._command(f"QU {key} {int(gap_ms)}")
        self._steps.append(QueuedStep(False, key, 0, int(gap_ms), action="release"))

    def queue_click(self, button: str = "left", hold_ms: int = 45, gap_ms: int = 0) -> None:
        button = normalize_button(button)
        self._command(f"QM {button} {int(hold_ms)} {int(gap_ms)}")
        self._steps.append(QueuedStep(True, button, int(hold_ms), int(gap_ms)))

    def queue_duration_ms(self, repeat: int = 1) -> int:
        """Kuyruğun kaç ms süreceğini hesaplar (okuma zaman aşımı için)."""
        per_round = sum(step.hold_ms + step.gap_ms for step in self._steps)
        return per_round * max(1, int(repeat))

    def run_queue(self, repeat: int = 1) -> int:
        """Kuyruğu Leonardo'ya çalıştırtır; kesilirse negatif değer döner."""
        serial_port = self._serial
        if serial_port is None:
            raise TransportError("bağlantı yok: önce connect() çağır")

        # Firmware combo bitene kadar cevap yazmaz; okuma süresini uzat.
        budget = self.queue_duration_ms(repeat) / 1000.0 + self.timeout + 1.0
        with self._lock:
            previous_timeout = serial_port.timeout  # type: ignore[attr-defined]
            serial_port.timeout = budget  # type: ignore[attr-defined]
            try:
                response = self._command(f"G {max(1, int(repeat))}", expect_prefix="")
            finally:
                serial_port.timeout = previous_timeout  # type: ignore[attr-defined]

        parts = response.split()
        count = int(parts[1]) if len(parts) > 1 and parts[1].lstrip("-").isdigit() else 0
        if response.startswith("ABORT"):
            return -count
        if not response.startswith("DONE"):
            raise TransportError(f"beklenmeyen combo cevabı: {response}")
        return count

    def abort(self) -> None:
        """Çalışan comboyu keser. Kilidi beklemez — panik yolu budur."""
        serial_port = self._serial
        if serial_port is None:
            return
        try:
            serial_port.write(b"A\n")  # type: ignore[attr-defined]
            serial_port.flush()  # type: ignore[attr-defined]
        except Exception as exc:  # pragma: no cover - donanıma bağlı
            log.warning("iptal gönderilemedi: %s", exc)


# ------------------------------------------------------------ yazılımsal mod


class SoftwareTransport(Transport):
    """Leonardo yokken ``pydirectinput`` ile tuş gönderir (yalnız Windows).

    DirectX oyunları çoğu zaman scancode bekler; ``pydirectinput`` bunu yapar
    ama yine de yazılımsal bir olaydır, Leonardo kadar güvenilir değildir.
    """

    name = "software"

    def __init__(self) -> None:
        self._backend = None
        self._held: set[str] = set()
        self._held_buttons: set[str] = set()

    def connect(self) -> None:
        try:
            import pydirectinput
        except ImportError as exc:  # pragma: no cover - ortama bağlı
            raise TransportError(
                "pydirectinput kurulu değil: pip install pydirectinput "
                "(ya da Leonardo'yu bağlayıp transport.kind=leonardo yap)"
            ) from exc
        pydirectinput.FAILSAFE = False
        pydirectinput.PAUSE = 0.0
        self._backend = pydirectinput

    def _require(self):
        if self._backend is None:
            raise TransportError("bağlantı yok: önce connect() çağır")
        return self._backend

    @staticmethod
    def _to_backend_key(key: str) -> str:
        """Bizim adlandırmayı pydirectinput adlandırmasına çevirir."""
        key = normalize_key(key)
        mapping = {
            "lctrl": "ctrlleft", "rctrl": "ctrlright",
            "lshift": "shiftleft", "rshift": "shiftright",
            "lalt": "altleft", "ralt": "altright",
            "pageup": "pageup", "pagedown": "pagedown",
            "numpadenter": "enter", "numpadplus": "add", "numpadminus": "subtract",
        }
        if key.startswith("numpad") and key[6:].isdigit():
            return f"num{key[6:]}"
        return mapping.get(key, key)

    def tap(self, key: str, hold_ms: int = 45) -> None:
        backend = self._require()
        backend_key = self._to_backend_key(key)
        backend.keyDown(backend_key)
        time.sleep(max(hold_ms, 1) / 1000.0)
        backend.keyUp(backend_key)

    def key_down(self, key: str) -> None:
        backend_key = self._to_backend_key(key)
        self._require().keyDown(backend_key)
        self._held.add(backend_key)

    def key_up(self, key: str) -> None:
        backend_key = self._to_backend_key(key)
        self._require().keyUp(backend_key)
        self._held.discard(backend_key)

    def click(self, button: str = "left", hold_ms: int = 45) -> None:
        backend = self._require()
        button = normalize_button(button)
        backend.mouseDown(button=button)
        time.sleep(max(hold_ms, 1) / 1000.0)
        backend.mouseUp(button=button)

    def mouse_down(self, button: str = "left") -> None:
        button = normalize_button(button)
        self._require().mouseDown(button=button)
        self._held_buttons.add(button)

    def mouse_up(self, button: str = "left") -> None:
        button = normalize_button(button)
        self._require().mouseUp(button=button)
        self._held_buttons.discard(button)

    def mouse_move(self, dx: int, dy: int) -> None:
        self._require().moveRel(int(dx), int(dy), relative=True)

    def release_all(self) -> None:
        backend = self._require()
        for key in list(self._held):
            backend.keyUp(key)
        self._held.clear()
        for button in list(self._held_buttons):
            backend.mouseUp(button=button)
        self._held_buttons.clear()

    def disarm(self) -> None:
        if self._backend is not None:
            self.release_all()


def create_transport(kind: str, port: str | None = None) -> Transport:
    """Config'deki ``transport.kind`` değerine göre uygun taşıma katmanını üretir."""
    kind = (kind or "").strip().lower()
    if kind in {"leonardo", "serial", "hid"}:
        return SerialHidTransport(port=port)
    if kind in {"software", "pydirectinput"}:
        return SoftwareTransport()
    if kind in {"dry", "dry-run", "dryrun", "none"}:
        return DryRunTransport(log_actions=True)
    raise ValueError(f"bilinmeyen transport türü: {kind!r} (leonardo|software|dry-run)")
