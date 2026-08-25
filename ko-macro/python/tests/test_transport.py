"""Taşıma katmanı ve firmware protokolü testleri."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from ko_macro.keys import NAMED_KEYS, UnknownKeyError, normalize_button
from ko_macro.transport import (
    DryRunTransport,
    SerialHidTransport,
    TransportError,
    create_transport,
)

FIRMWARE = (
    Path(__file__).resolve().parents[2] / "arduino" / "ko_hid_bridge" / "ko_hid_bridge.ino"
)


class FakeSerial:
    """Firmware yerine geçen sahte seri port."""

    def __init__(self, responses: list[bytes] | None = None) -> None:
        self.written: list[str] = []
        self.responses = responses or []
        self.timeout = 1.0
        self.closed = False

    def write(self, payload: bytes) -> int:
        self.written.append(payload.decode("ascii").strip())
        return len(payload)

    def flush(self) -> None:
        pass

    def readline(self) -> bytes:
        if self.responses:
            return self.responses.pop(0)
        return b"OK\n"

    def reset_input_buffer(self) -> None:
        pass

    def close(self) -> None:
        self.closed = True


def make_serial_transport(responses=None) -> tuple[SerialHidTransport, FakeSerial]:
    transport = SerialHidTransport(port="FAKE")
    fake = FakeSerial(responses)
    transport._serial = fake
    return transport, fake


# --------------------------------------------------------------- firmware eşliği


def test_firmware_knows_every_named_key():
    """Python'daki her özel tuş adı firmware tablosunda da olmalı."""
    source = FIRMWARE.read_text(encoding="utf-8")
    table = re.findall(r'\{"([a-z0-9]+)",\s*[A-Z_0-9\' ]+\}', source)
    missing = NAMED_KEYS - set(table)
    assert not missing, f"firmware'de eksik tuşlar: {sorted(missing)}"


def test_firmware_queue_capacity_matches_python():
    from ko_macro.sequence import MAX_BURST_STEPS

    source = FIRMWARE.read_text(encoding="utf-8")
    match = re.search(r"MAX_STEPS\s*=\s*(\d+)", source)
    assert match and int(match.group(1)) == MAX_BURST_STEPS


# ------------------------------------------------------------------- kuru mod


def test_dry_run_records_actions():
    transport = DryRunTransport()
    transport.tap("f1", 50)
    transport.click("right", 30)
    transport.mouse_move(10, -20)

    kinds = [(action.kind, action.target) for action in transport.actions]
    assert kinds == [("tap", "f1"), ("click", "right"), ("mouse_move", "10,-20")]


def test_dry_run_normalizes_keys():
    transport = DryRunTransport()
    transport.tap("ESCAPE")
    assert transport.actions[0].target == "esc"


def test_dry_run_rejects_unknown_key():
    transport = DryRunTransport()
    with pytest.raises(UnknownKeyError):
        transport.tap("gitar")


def test_fallback_queue_executes_steps_in_order():
    transport = DryRunTransport()
    transport.queue_key("1", 40, 100)
    transport.queue_key("2", 40, 0)
    executed = transport.run_queue(2)

    assert executed == 4
    taps = [a.target for a in transport.actions if a.kind == "tap"]
    assert taps == ["1", "2", "1", "2"]
    assert any(a.kind == "wait" for a in transport.actions)


# ------------------------------------------------------------- seri protokolü


def test_commands_are_formatted_for_firmware():
    transport, fake = make_serial_transport()
    transport.tap("f1", 40)
    transport.key_down("lctrl")
    transport.click("left", 60)
    transport.mouse_move(5, -5)

    assert fake.written == ["T f1 40", "D lctrl", "C left 60", "MV 5 -5"]


def test_queue_commands_go_to_firmware():
    transport, fake = make_serial_transport()
    transport.queue_clear()
    transport.queue_key("1", 40, 120)
    transport.queue_click("right", 50, 0)

    assert fake.written == ["QC", "QK 1 40 120", "QM right 50 0"]


def test_run_queue_parses_done():
    transport, fake = make_serial_transport()
    transport.queue_key("1", 40, 10)
    fake.responses = [b"DONE 3\n"]
    assert transport.run_queue(3) == 3


def test_run_queue_reports_abort_as_negative():
    transport, fake = make_serial_transport()
    transport.queue_key("1", 40, 10)
    fake.responses = [b"ABORT 2\n"]
    assert transport.run_queue(1) == -2


def test_error_response_raises():
    transport, fake = make_serial_transport([b"ERR unknown key\n"])
    with pytest.raises(TransportError, match="cihaz hata döndü"):
        transport.tap("f1")


def test_silence_raises():
    transport, fake = make_serial_transport([b""])
    with pytest.raises(TransportError, match="cevap vermedi"):
        transport.tap("f1")


def test_abort_writes_without_waiting():
    transport, fake = make_serial_transport()
    transport.abort()
    assert fake.written == ["A"]


def test_queue_duration_covers_holds_and_gaps():
    transport, _ = make_serial_transport()
    transport.queue_key("1", 40, 100)
    transport.queue_key("2", 60, 0)
    assert transport.queue_duration_ms(2) == (40 + 100 + 60) * 2


def test_command_without_connection_raises():
    transport = SerialHidTransport(port="FAKE")
    with pytest.raises(TransportError, match="bağlantı yok"):
        transport.tap("f1")


# ------------------------------------------------------------------- fabrika


@pytest.mark.parametrize(
    "kind,expected",
    [("leonardo", "leonardo"), ("dry-run", "dry-run"), ("software", "software")],
)
def test_create_transport(kind, expected):
    assert create_transport(kind).name == expected


def test_create_transport_rejects_unknown():
    with pytest.raises(ValueError, match="bilinmeyen transport"):
        create_transport("teleport")


def test_button_validation():
    with pytest.raises(UnknownKeyError):
        normalize_button("orta")
    assert normalize_button("MIDDLE") == "middle"
