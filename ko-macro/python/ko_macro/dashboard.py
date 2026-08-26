"""Terminal panosu.

``rich`` kuruluysa canlı tablo çizer; yoksa düz metne düşer. Pano yalnızca
okur, hiçbir tuşa basmaz.
"""

from __future__ import annotations

import time
from typing import Any

from .spawn import SpawnBook, SpawnPrediction, format_eta

_STATE_STYLE = {
    "pencere": "bold green",
    "gecikti": "bold yellow",
    "bekliyor": "cyan",
    "bilinmiyor": "dim",
}


def _pct(value: float | None) -> str:
    return "-" if value is None else f"%{value * 100:.0f}"


def status_lines(status: dict[str, Any]) -> list[str]:
    """Motor durumunu düz metin satırlarına çevirir."""
    uptime = int(status.get("uptime_s", 0))
    return [
        f"cihaz     : {status['transport']}   profil: {status['profile']}",
        f"durum     : {'çalışıyor' if status['running'] else 'durdu'}"
        f"   farm: {'açık' if status['farm'] else 'kapalı'}"
        f"   kısayol: {'aktif' if status['hotkeys'] else 'pasif'}",
        f"combo     : {status['last_combo']} (toplam {status['combo_count']})",
        f"can/mana  : {_pct(status.get('hp_pct'))} / {_pct(status.get('mp_pct'))}"
        f"   hedef: {_pct(status.get('target_hp_pct'))}",
        f"farm      : {status.get('farm_kills', 0)} kill / {status['farm_cycles']} tur"
        f"   {status['kills_per_hour']:.0f} kill/saat",
        f"eleme     : boş {status.get('farm_misses', 0)}"
        f"   yarım canlı {status.get('farm_skipped', 0)}"
        f"   yanlış mob {status.get('farm_wrong_mob', 0)}"
        f"   menzil dışı {status.get('farm_abandoned', 0)}"
        f"   kesilen combo {status.get('farm_cut_short', 0)}",
        f"hedefleme : etiket tıklama {status.get('farm_plate_clicks', 0)}"
        f"   etiket yok {status.get('farm_no_plates', 0)}"
        f"   kayıttan ölüm {status.get('farm_log_kills', 0)}",
        f"süre      : {uptime // 60}d {uptime % 60:02d}s"
        f"   son kill: {int(status.get('session_idle_s', 0))}s önce",
    ] + _autocast_lines(status) + (
        [f"DURDU     : {status['stop_reason']}"] if status.get("stop_reason") else []
    ) + (
        [f"hata      : {status['error']}"] if status.get("error") else []
    )


def _autocast_lines(status: dict[str, Any]) -> list[str]:
    """Otomatik yeteneklerin geri sayımı."""
    rules = status.get("autocast") or []
    if not rules:
        return []
    parts = [f"{name} {int(remaining)}s" for name, remaining in rules[:6]]
    return [f"otomatik  : {'  '.join(parts)}"]


def spawn_rows(predictions: list[SpawnPrediction]) -> list[tuple[str, ...]]:
    """Doğuş tahminlerini tablo satırlarına çevirir."""
    rows: list[tuple[str, ...]] = []
    for prediction in predictions:
        if prediction.state == "bilinmiyor":
            eta = "kayıt yok"
        elif prediction.eta_s is not None and prediction.eta_s > 0:
            eta = format_eta(prediction.eta_s)
        else:
            eta = "ŞİMDİ"
        rows.append(
            (
                prediction.name,
                prediction.zone or "-",
                prediction.state,
                eta,
                f"%{prediction.probability_now * 100:.0f}",
                f"%{prediction.confidence * 100:.0f}",
                str(prediction.samples),
                str(prediction.missed_cycles) if prediction.missed_cycles else "-",
            )
        )
    return rows


SPAWN_HEADERS = ("mob", "bölge", "durum", "pencere", "doğmuş?", "güven", "örnek", "kaçan")


def render_plain(status: dict[str, Any] | None, predictions: list[SpawnPrediction]) -> str:
    """rich yokken kullanılan düz metin çıktısı."""
    parts: list[str] = []
    if status is not None:
        parts.extend(status_lines(status))
        parts.append("")

    rows = spawn_rows(predictions)
    widths = [
        max(len(SPAWN_HEADERS[i]), *(len(row[i]) for row in rows)) if rows else len(SPAWN_HEADERS[i])
        for i in range(len(SPAWN_HEADERS))
    ]
    parts.append("  ".join(header.ljust(widths[i]) for i, header in enumerate(SPAWN_HEADERS)))
    parts.append("  ".join("-" * width for width in widths))
    for row in rows:
        parts.append("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)))
    return "\n".join(parts)


def _build_renderable(status: dict[str, Any] | None, predictions: list[SpawnPrediction]):
    """rich için tablo/panel bileşimi."""
    from rich.console import Group
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text

    blocks = []
    if status is not None:
        info = Text("\n".join(status_lines(status)))
        blocks.append(Panel(info, title="ko-macro", border_style="blue"))

    table = Table(title="Doğuş takibi", header_style="bold")
    for header in SPAWN_HEADERS:
        table.add_column(header)
    for prediction, row in zip(predictions, spawn_rows(predictions)):
        table.add_row(*row, style=_STATE_STYLE.get(prediction.state, ""))
    blocks.append(table)
    return Group(*blocks)


def _watch_plain(book: SpawnBook, status_provider, refresh_s: float, iterations: int | None) -> None:
    """rich yokken: ekranı her turda baştan yazar."""
    count = 0
    while iterations is None or count < iterations:
        status = status_provider() if status_provider else None
        print("\033[2J\033[H" + render_plain(status, book.predictions()), flush=True)
        count += 1
        if iterations is not None and count >= iterations:
            break
        time.sleep(refresh_s)


def watch(
    book: SpawnBook,
    status_provider=None,
    refresh_s: float = 1.0,
    iterations: int | None = None,
) -> None:
    """Panoyu canlı çizer. ``iterations`` verilirse o kadar tur sonra çıkar."""
    try:
        from rich.console import Console
        from rich.live import Live
    except ImportError:
        _watch_plain(book, status_provider, refresh_s, iterations)
        return

    count = 0
    with Live(refresh_per_second=max(1, int(1 / refresh_s)), console=Console()) as live:
        while iterations is None or count < iterations:
            status = status_provider() if status_provider else None
            live.update(_build_renderable(status, book.predictions()))
            count += 1
            if iterations is not None and count >= iterations:
                break
            time.sleep(refresh_s)
