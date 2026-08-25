"""Komut satırı arayüzü.

    python -m ko_macro run --config config.yaml
    python -m ko_macro spawn list
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

from . import __version__
from .config import AppConfig, ConfigError, available_profiles, load_config
from .dashboard import render_plain, watch
from .sequence import describe_combo
from .spawn import SpawnBook, SpawnError, SpawnPoint, format_eta
from .transport import SerialHidTransport, TransportError, create_transport

log = logging.getLogger("ko_macro")


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )


def _load(args: argparse.Namespace) -> AppConfig:
    config = load_config(args.config)
    if getattr(args, "dry_run", False):
        config.transport.kind = "dry-run"
    if getattr(args, "port", None):
        config.transport.port = args.port
    return config


def _book(args: argparse.Namespace, config: AppConfig | None = None) -> SpawnBook:
    path = getattr(args, "spawn_file", None)
    if not path:
        path = config.spawn_file if config else "spawns.json"
    return SpawnBook(path).load()


# ------------------------------------------------------------------- komutlar


def cmd_devices(args: argparse.Namespace) -> int:
    """Bağlı Leonardo'ları listeler."""
    try:
        ports = SerialHidTransport.discover_ports()
    except TransportError as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1
    if not ports:
        print("Leonardo benzeri bir cihaz bulunamadı.")
        print("Kabloyu kontrol et; firmware yüklü mü diye bak (arduino/ko_hid_bridge).")
        return 1
    for port, description in ports:
        print(f"{port}\t{description}")
    return 0


def cmd_profiles(args: argparse.Namespace) -> int:
    """Hazır sınıf profillerini listeler."""
    names = available_profiles()
    if not names:
        print("profil bulunamadı")
        return 1
    for name in names:
        print(name)
    return 0


def cmd_combos(args: argparse.Namespace) -> int:
    """Comboları, yardımcı makroları, kısayolları ve otomatik kuralları gösterir."""
    from .utility import build_utility_combos

    config = _load(args)
    utilities = build_utility_combos(config.utility)
    if not config.combos and not utilities:
        print("tanımlı combo yok")
        return 1

    names = [combo.name for combo in config.combos] + list(utilities)
    width = max(len(name) for name in names)

    def show(combo, hotkey: str) -> None:
        print(f"{combo.name.ljust(width)}  [{hotkey:>5}]  {describe_combo(combo, config.skillbar)}")
        if combo.description:
            print(f"{' ' * width}          {combo.description}")
        print(
            f"{' ' * width}          süre ~{combo.duration_ms()} ms"
            f", cooldown {combo.cooldown_ms} ms"
        )

    for combo in config.combos:
        show(combo, combo.hotkey or "-")

    if utilities:
        print("\n-- yardımcı makrolar --")
        for name, combo in utilities.items():
            show(combo, config.utility.hotkeys.get(name, "-"))

    if config.autocast:
        print("\n-- otomatik (autocast) --")
        for rule in config.autocast:
            trigger = []
            if rule.every_s > 0:
                trigger.append(f"her {rule.every_s:.0f}s")
            if rule.when_hp_below is not None:
                trigger.append(f"can <%{rule.when_hp_below:.0f}")
            if rule.when_mp_below is not None:
                trigger.append(f"mana <%{rule.when_mp_below:.0f}")
            if rule.only_when_farming:
                trigger.append("sadece farmda")
            state = "" if rule.enabled else "  (kapalı)"
            action = rule.combo or f"tuş:{rule.key}"
            print(f"{rule.name.ljust(width)}  → {action}  ({', '.join(trigger)}){state}")
    return 0


def _find_any_combo(config: AppConfig, name: str):
    """Adı önce combolarda, sonra yardımcı makrolarda arar."""
    from .utility import build_utility_combos

    return config.find_combo(name) or build_utility_combos(config.utility).get(name)


def cmd_test(args: argparse.Namespace) -> int:
    """Tek bir comboyu ya da yardımcı makroyu çalıştırır."""
    config = _load(args)
    combo = _find_any_combo(config, args.combo)
    if combo is None:
        from .utility import build_utility_combos

        known = sorted(
            [c.name for c in config.combos] + list(build_utility_combos(config.utility))
        )
        print(f"combo bulunamadı: {args.combo}", file=sys.stderr)
        print(f"tanımlı olanlar: {', '.join(known) or 'yok'}", file=sys.stderr)
        return 1

    from .clock import RealClock
    from .sequence import ComboRunner

    transport = create_transport(config.transport.kind, config.transport.port)
    print(f"{combo.name}: {describe_combo(combo, config.skillbar)}")
    if args.countdown > 0:
        for remaining in range(args.countdown, 0, -1):
            print(f"  {remaining}...", end="\r", flush=True)
            time.sleep(1)
        print(" " * 20, end="\r")

    with transport:
        transport.arm()
        runner = ComboRunner(
            transport=transport, timing=config.timing,
            clock=RealClock(), skillbar=config.skillbar,
            stance_key=config.stance_key, stance_delay_ms=config.stance_delay_ms,
        )
        result = runner.run(combo, repeat=args.repeat)
        transport.disarm()

    print(
        f"bitti: {result.rounds} tur, {result.steps} adım, {result.duration_ms} ms"
        + (" (kesildi)" if result.aborted else "")
    )
    if hasattr(transport, "actions"):
        for action in transport.actions:  # type: ignore[attr-defined]
            print(f"  {action.kind:<12} {action.target:<8} {action.hold_ms or ''}")
    return 0


def cmd_vitals(args: argparse.Namespace) -> int:
    """Can/mana barlarını bir kez okur — koordinat ayarı için."""
    config = _load(args)
    if not config.vitals.enabled or (not config.vitals.hp and not config.vitals.mp):
        print("vitals kapalı ya da bar bölgesi tanımlı değil", file=sys.stderr)
        return 1

    from .vitals import create_monitor

    monitor = create_monitor(config.vitals)
    for _ in range(max(1, args.samples)):
        snapshot = monitor.read(time.monotonic())
        hp = "-" if snapshot.hp_pct is None else f"%{snapshot.hp_pct * 100:.0f}"
        mp = "-" if snapshot.mp_pct is None else f"%{snapshot.mp_pct * 100:.0f}"
        print(f"can: {hp}\tmana: {mp}")
        if args.samples > 1:
            time.sleep(0.5)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    """Motoru çalıştırır."""
    config = _load(args)
    book = _book(args, config)
    from .runtime import MacroEngine

    engine = MacroEngine(config=config, spawn_book=book)
    try:
        engine.start(with_hotkeys=not args.no_hotkeys)
    except TransportError as exc:
        print(f"cihaza bağlanılamadı: {exc}", file=sys.stderr)
        return 1

    hotkeys = config.hotkeys
    print(f"ko-macro {__version__} — {config.transport.kind} / profil: {config.profile_name or '-'}")
    print(f"  {hotkeys.start_stop.upper()}: farm aç/kapa    {hotkeys.panic.upper()}: acil durdur")
    if hotkeys.mark_kill:
        print(f"  {hotkeys.mark_kill.upper()}: öldürmeyi doğuş defterine yaz")
    for combo in config.combos:
        if combo.hotkey:
            print(f"  {combo.hotkey.upper()}: {combo.name}")
    print("  Ctrl+C ile çık")

    try:
        if args.watch:
            watch(book, status_provider=engine.status, refresh_s=args.refresh)
        else:
            while engine.running:
                time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nkapatılıyor...")
    finally:
        engine.stop()
    return 0


# ----------------------------------------------------------------- doğuş komutları


def cmd_spawn_add(args: argparse.Namespace) -> int:
    book = _book(args)
    point = SpawnPoint(
        id=args.id,
        name=args.name or args.id,
        zone=args.zone,
        respawn_min_s=args.min * 60.0,
        respawn_max_s=(args.max if args.max is not None else args.min) * 60.0,
        priority=args.priority,
        notes=args.notes,
    )
    book.add(point)
    book.save()
    print(
        f"eklendi: {point.name} ({point.id}) — doğuş "
        f"{point.respawn_min_s / 60:.0f}-{point.respawn_max_s / 60:.0f} dk"
    )
    return 0


def cmd_spawn_rm(args: argparse.Namespace) -> int:
    book = _book(args)
    book.remove(args.id)
    book.save()
    print(f"silindi: {args.id}")
    return 0


def cmd_spawn_kill(args: argparse.Namespace) -> int:
    book = _book(args)
    at = None
    if args.ago is not None:
        at = time.time() - args.ago * 60.0
    moment = book.record_kill(args.id, at)
    prediction = next(p for p in book.predictions() if p.point_id == args.id)
    print(f"kayıt: {args.id} @ {time.strftime('%H:%M:%S', time.localtime(moment))}")
    print(
        f"sıradaki pencere: {format_eta(prediction.eta_s)} sonra"
        f" (güven %{prediction.confidence * 100:.0f}, {prediction.samples} örnek)"
    )
    return 0


def cmd_spawn_list(args: argparse.Namespace) -> int:
    book = _book(args)
    if not book.points:
        print("doğuş noktası yok — 'spawn add' ile ekle")
        return 1
    print(render_plain(None, book.predictions()))
    return 0


def cmd_spawn_travel(args: argparse.Namespace) -> int:
    book = _book(args)
    book.get(args.source)
    book.get(args.target)
    book.set_travel(args.source, args.target, args.seconds, both_ways=not args.one_way)
    book.save()
    print(f"yol süresi: {args.source} → {args.target} = {args.seconds:.0f}s")
    return 0


def cmd_spawn_route(args: argparse.Namespace) -> int:
    book = _book(args)
    stops = book.route(start_at=args.start, max_stops=args.stops)
    if not stops:
        print("planlanacak aktif doğuş yok")
        return 1
    now = time.time()
    print("sıra  mob                 yol      bekleme   varış     puan")
    for index, stop in enumerate(stops, start=1):
        arrival = time.strftime("%H:%M", time.localtime(stop.arrive_at))
        print(
            f"{index:>3}.  {stop.name[:18].ljust(18)}  "
            f"{format_eta(stop.travel_s):>7}  {format_eta(stop.wait_s):>7}   "
            f"{arrival}   {stop.score:.3f}"
        )
    print(f"\n(şu an {time.strftime('%H:%M', time.localtime(now))})")
    return 0


def cmd_spawn_watch(args: argparse.Namespace) -> int:
    book = _book(args)
    try:
        watch(book, refresh_s=args.refresh)
    except KeyboardInterrupt:
        pass
    return 0


# ------------------------------------------------------------------ ayrıştırıcı


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ko-macro",
        description="Knight Online combo / farm makrosu ve doğuş takipçisi",
    )
    parser.add_argument("--version", action="version", version=f"ko-macro {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="ayrıntılı günlük")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def with_config(sub: argparse.ArgumentParser) -> argparse.ArgumentParser:
        sub.add_argument("-c", "--config", default="config.yaml", help="config dosyası")
        sub.add_argument("--dry-run", action="store_true", help="tuşa basma, sadece yazdır")
        sub.add_argument("--port", help="seri port (örn. COM5)")
        return sub

    run = with_config(subparsers.add_parser("run", help="motoru çalıştır"))
    run.add_argument("--no-hotkeys", action="store_true", help="global kısayolları kurma")
    run.add_argument("--watch", action="store_true", help="canlı pano göster")
    run.add_argument("--refresh", type=float, default=1.0, help="pano tazeleme (sn)")
    run.add_argument("--spawn-file", help="doğuş kayıt dosyası")
    run.set_defaults(func=cmd_run)

    test = with_config(subparsers.add_parser("test", help="tek combo çalıştır"))
    test.add_argument("combo", help="combo adı")
    test.add_argument("--repeat", type=int, default=1, help="kaç tur")
    test.add_argument("--countdown", type=int, default=3, help="başlamadan önce geri sayım (sn)")
    test.set_defaults(func=cmd_test)

    combos = with_config(subparsers.add_parser("combos", help="comboları listele"))
    combos.set_defaults(func=cmd_combos)

    vitals = with_config(subparsers.add_parser("vitals", help="can/mana barını oku"))
    vitals.add_argument("--samples", type=int, default=1, help="kaç okuma")
    vitals.set_defaults(func=cmd_vitals)

    devices = subparsers.add_parser("devices", help="bağlı cihazları listele")
    devices.set_defaults(func=cmd_devices)

    profiles = subparsers.add_parser("profiles", help="hazır sınıf profilleri")
    profiles.set_defaults(func=cmd_profiles)

    spawn = subparsers.add_parser("spawn", help="doğuş takibi")
    spawn.add_argument("--spawn-file", default="spawns.json", help="kayıt dosyası")
    spawn_subparsers = spawn.add_subparsers(dest="spawn_command", required=True)

    add = spawn_subparsers.add_parser("add", help="doğuş noktası ekle")
    add.add_argument("id", help="kısa kimlik (örn. felankor)")
    add.add_argument("--name", help="görünen ad")
    add.add_argument("--zone", default="", help="bölge")
    add.add_argument("--min", type=float, required=True, help="en kısa doğuş (dakika)")
    add.add_argument("--max", type=float, help="en uzun doğuş (dakika, boşsa min ile aynı)")
    add.add_argument("--priority", type=int, default=1, help="öncelik (rota planında ağırlık)")
    add.add_argument("--notes", default="", help="not")
    add.set_defaults(func=cmd_spawn_add)

    remove = spawn_subparsers.add_parser("rm", help="doğuş noktası sil")
    remove.add_argument("id")
    remove.set_defaults(func=cmd_spawn_rm)

    kill = spawn_subparsers.add_parser("kill", help="öldürme kaydet")
    kill.add_argument("id")
    kill.add_argument("--ago", type=float, help="kaç dakika önce öldü")
    kill.set_defaults(func=cmd_spawn_kill)

    listing = spawn_subparsers.add_parser("list", help="tahminleri göster")
    listing.set_defaults(func=cmd_spawn_list)

    travel = spawn_subparsers.add_parser("travel", help="iki nokta arası yol süresi")
    travel.add_argument("source")
    travel.add_argument("target")
    travel.add_argument("seconds", type=float)
    travel.add_argument("--one-way", action="store_true", help="sadece tek yön")
    travel.set_defaults(func=cmd_spawn_travel)

    route = spawn_subparsers.add_parser("route", help="gezinme sırası öner")
    route.add_argument("--start", help="şu an bulunduğun nokta")
    route.add_argument("--stops", type=int, default=6, help="en fazla durak")
    route.set_defaults(func=cmd_spawn_route)

    spawn_watch = spawn_subparsers.add_parser("watch", help="canlı doğuş panosu")
    spawn_watch.add_argument("--refresh", type=float, default=1.0)
    spawn_watch.set_defaults(func=cmd_spawn_watch)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)
    try:
        return int(args.func(args))
    except (ConfigError, SpawnError, TransportError) as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(f"dosya yok: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
