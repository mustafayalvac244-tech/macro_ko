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
from .paths import find_user_file, resource_dir
from .sequence import describe_combo
from .spawn import SpawnBook, SpawnError, SpawnPoint, format_eta
from .transport import SerialHidTransport, TransportError, create_transport

log = logging.getLogger("ko_macro")


def setup_console() -> None:
    """Windows konsolunda Türkçe karakterler ve ``→`` oku bozulmasın.

    Windows'un eski varsayılan kod sayfası (cp1252) 'ı', 'ş', 'ğ' ve ok
    işaretini kodlayamaz; bu da programı ``UnicodeEncodeError`` ile
    düşürür. Konsolu UTF-8'e alıyoruz, alamazsak da kodlanamayan karakter
    programı çökertmek yerine '?' olarak yazılıyor.
    """
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.kernel32.SetConsoleOutputCP(65001)  # type: ignore[attr-defined]
            ctypes.windll.kernel32.SetConsoleCP(65001)  # type: ignore[attr-defined]
        except Exception:
            pass  # Kod sayfası değişmezse aşağıdaki errors="replace" kurtarır.

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError, OSError):
            pass


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )


def _ensure_config(name: str) -> Path:
    """Config dosyasını bulur; hiç yoksa örnekten bir tane oluşturur.

    Exe olarak dağıtıldığında kullanıcının elle dosya kopyalamasını
    beklememek için ilk çalıştırmada örnek config yanına açılır.
    """
    path = find_user_file(name)
    if path.is_file():
        return path

    example = resource_dir() / "config.example.yaml"
    if not example.is_file():
        raise ConfigError(f"config dosyası yok: {path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"İlk çalıştırma: örnek ayarlar {path} olarak oluşturuldu.")
    print("Tuş dizilimini ve bar koordinatlarını buradan düzenle.\n")
    return path


def _load(args: argparse.Namespace) -> AppConfig:
    config = load_config(_ensure_config(args.config))
    if getattr(args, "dry_run", False):
        config.transport.kind = "dry-run"
    if getattr(args, "port", None):
        config.transport.port = args.port
    return config


def _book(args: argparse.Namespace, config: AppConfig | None = None) -> SpawnBook:
    path = getattr(args, "spawn_file", None)
    if not path:
        path = config.spawn_file if config else "spawns.json"
    # Kayıtlar exe'nin yanında dursun, geçici klasörde değil.
    return SpawnBook(find_user_file(str(path))).load()


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


def _write_config_patch(path: Path, patches: dict[str, dict]) -> Path:
    """Config'e bulunan değerleri yazar, öncesinde yedek alır.

    Dosya yeniden yazıldığı için içindeki açıklama satırları kaybolur; bu
    yüzden orijinali ``.yedek`` uzantısıyla saklanır.
    """
    import yaml

    from .config import _deep_merge, read_yaml

    current = read_yaml(path)
    merged = _deep_merge(current, patches)

    backup = path.with_suffix(path.suffix + ".yedek")
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

    header = (
        "# Bu dosya 'kalibre' komutuyla güncellendi.\n"
        "# Açıklama satırları bu sırada kayboldu; eski hâli .yedek dosyasında.\n\n"
    )
    path.write_text(
        header + yaml.safe_dump(merged, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    return backup


def cmd_calibrate(args: argparse.Namespace) -> int:
    """Can/mana/hedef barlarını ekranda kendiliğinden bulur."""
    from .calibrate import MSSScreen, build_farm_patch, build_vitals_patch, find_bars, suggest

    print("Ekran taranıyor...")
    print("(Oyun açık ve görünür olmalı; canın TAM DOLU olsun ki bar tam ölçülsün.)\n")

    try:
        screen = MSSScreen()
    except RuntimeError as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1

    candidates = find_bars(screen, min_width=args.min_width)
    if not candidates:
        print("Hiç bar bulunamadı.", file=sys.stderr)
        print(
            "Oyun görünür mü? Canın dolu mu? --min-width değerini düşürüp dene "
            "(örn. --min-width 30).",
            file=sys.stderr,
        )
        return 1

    print(f"{len(candidates)} aday bulundu ({screen.width}x{screen.height}):\n")
    for index, bar in enumerate(candidates[: args.limit], start=1):
        print(f"  {index:>2}. {bar.describe(screen.width)}")

    guess = suggest(candidates, screen.width)
    print("\nTahmin:")
    print(f"  can    : {guess.hp.describe(screen.width) if guess.hp else 'bulunamadı'}")
    print(f"  mana   : {guess.mp.describe(screen.width) if guess.mp else 'bulunamadı'}")
    print(f"  hedef  : {guess.target.describe(screen.width) if guess.target else 'bulunamadı'}")

    if not guess.complete:
        print("\nCan barı bulunamadığı için yazma yapılmadı.", file=sys.stderr)
        return 1

    if not args.write:
        print("\nBunları config'e yazmak için: kalibre --yaz")
        return 0

    patches: dict[str, dict] = {"vitals": build_vitals_patch(guess)}
    farm_patch = build_farm_patch(guess)
    if farm_patch:
        patches["farm"] = farm_patch

    path = _ensure_config(args.config)
    backup = _write_config_patch(path, patches)
    print(f"\nYazıldı: {path}")
    print(f"Eski hâli: {backup}")
    print("\nDoğrulamak için: vitals --samples 5")
    return 0


def cmd_learn_mob(args: argparse.Namespace) -> int:
    """Seçili hedefin adını parmak izi olarak kaydeder."""
    from .calibrate import MSSScreen, find_bars, suggest
    from .nameplate import NameRegion, fingerprint, is_blank

    config = _load(args)
    print(f"'{args.name}' öğreniliyor.")
    print("Oyunda bu mobu SEÇİLİ bırak, pencere görünür olsun.\n")

    if args.countdown > 0:
        for remaining in range(args.countdown, 0, -1):
            print(f"  {remaining}...", end="\r", flush=True)
            time.sleep(1)
        print(" " * 20, end="\r")

    try:
        screen = MSSScreen()
    except RuntimeError as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1

    # Ad bölgesi: hedef can barının hemen üstündeki şerit.
    region_raw = config.farm.name_region
    if region_raw:
        region = NameRegion.from_dict(region_raw)
    else:
        bar = config.farm.target_bar
        if bar is None:
            guess = suggest(find_bars(screen), screen.width)
            if guess.target is None:
                print(
                    "Hedef barı bulunamadı. Önce 'kalibre --yaz' çalıştır "
                    "(mob seçiliyken).",
                    file=sys.stderr,
                )
                return 1
            x0, x1, y = guess.target.x0, guess.target.x1, guess.target.y
        else:
            x0, x1, y = bar.x0, bar.x1, bar.y
        # Ad, barın üstünde yazılır.
        region = NameRegion(
            x0=x0, y0=max(0, y - args.height - args.gap), x1=x1, y1=max(1, y - args.gap)
        )
        print(f"Ad bölgesi barın üstünden türetildi: {region.to_dict()}")

    signature = fingerprint(screen, region)
    ink = signature.count("1") / len(signature) * 100
    print(f"Parmak izi alındı (%{ink:.0f} dolu).")

    if is_blank(signature):
        print(
            "\nBölge boş görünüyor — mob seçili mi? Ad bölgesi yanlış yerde olabilir.",
            file=sys.stderr,
        )
        print("--height / --gap ile bölgeyi kaydırıp tekrar dene.", file=sys.stderr)
        return 1

    names = dict(config.farm.mob_names)
    names[args.name] = signature
    path = _ensure_config(args.config)
    backup = _write_config_patch(
        path,
        {"farm": {"name_region": region.to_dict(), "mob_names": names}},
    )
    print(f"\nKaydedildi: {args.name}")
    print(f"Tanınan moblar: {', '.join(sorted(names))}")
    print(f"Config: {path}   (eski hâli: {backup})")
    print("\nArtık farm döngüsü sadece bu adlara benzeyen hedefleri döver.")
    return 0


def _parse_region(text: str) -> dict[str, int]:
    """``x0,y0,x1,y1`` metnini bölgeye çevirir."""
    try:
        x0, y0, x1, y1 = (int(part) for part in text.split(","))
    except ValueError:
        raise ConfigError(f"bölge biçimi x0,y0,x1,y1 olmalı, gelen: {text!r}") from None
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def _coord_regions(config: AppConfig, args: argparse.Namespace):
    """Config ve komut satırından X/Y bölgelerini çözer."""
    from .ocr import TextRegion

    raw_x = _parse_region(args.bolge_x) if getattr(args, "bolge_x", None) else config.coords.region_x
    raw_y = _parse_region(args.bolge_y) if getattr(args, "bolge_y", None) else config.coords.region_y
    if not raw_x or not raw_y:
        raise ConfigError(
            "Koordinatın ekranda yazdığı iki kutuyu bir kez vermen gerekiyor:\n"
            "  koordinat-ogren 512 378 --bolge-x x0,y0,x1,y1 --bolge-y x0,y0,x1,y1\n\n"
            "Her kutu SADECE kendi sayısını kapsasın (etiket, ayırıcı ve çerçeve "
            "dışarıda kalsın)."
        )
    return TextRegion.from_dict(raw_x), TextRegion.from_dict(raw_y)


def _digit_reader(config: AppConfig):
    """Config'den rakam okuyucuyu kurar."""
    from .ocr import DigitReader

    return DigitReader(
        glyphs=dict(config.coords.glyphs), threshold=config.coords.threshold
    )


def cmd_learn_coords(args: argparse.Namespace) -> int:
    """Ekrandaki koordinat rakamlarını öğretir."""
    from .calibrate import MSSScreen
    from .ocr import OcrError

    config = _load(args)
    try:
        region_x, region_y = _coord_regions(config, args)
    except ConfigError as exc:
        print(exc, file=sys.stderr)
        return 1

    reader = _digit_reader(config)
    print(f"Ekranda yazan: X={args.x_degeri}  Y={args.y_degeri}")
    print("Oyun penceresi görünür olsun.\n")
    if args.countdown > 0:
        for remaining in range(args.countdown, 0, -1):
            print(f"  {remaining}...", end="\r", flush=True)
            time.sleep(1)
        print(" " * 20, end="\r")

    try:
        screen = MSSScreen()
        learned = reader.learn(screen, region_x, args.x_degeri)
        learned += reader.learn(screen, region_y, args.y_degeri)
    except (RuntimeError, OcrError) as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1

    path = _ensure_config(args.config)
    backup = _write_config_patch(
        path,
        {"coords": {
            "region_x": region_x.to_dict(),
            "region_y": region_y.to_dict(),
            "glyphs": reader.glyphs,
        }},
    )
    print(f"Yeni öğrenilen: {', '.join(sorted(set(learned))) or 'yok (hepsi zaten vardı)'}")
    print(f"Bilinen rakamlar: {', '.join(sorted(reader.glyphs)) or 'yok'}")
    if reader.missing_digits:
        print(f"\nEksik rakamlar: {', '.join(reader.missing_digits)}")
        print("Bu rakamların göründüğü bir yere gidip komutu tekrar çalıştır.")
    else:
        print("\nTüm rakamlar öğrenildi. Kontrol için: koordinat")
    print(f"Config: {path}   (eski hâli: {backup})")
    return 0


def cmd_coords(args: argparse.Namespace) -> int:
    """Şu anki koordinatı ekrandan okur."""
    from .calibrate import MSSScreen
    from .ocr import OcrError

    config = _load(args)
    try:
        region_x, region_y = _coord_regions(config, args)
        reader = _digit_reader(config)
        screen = MSSScreen()
        x, y = reader.read_coordinates(screen, region_x, region_y)
    except (ConfigError, RuntimeError, OcrError) as exc:
        print(f"hata: {exc}", file=sys.stderr)
        return 1

    print(f"konum: {x}, {y}")
    return 0


def cmd_setup(args: argparse.Namespace) -> int:
    """Kurulumu baştan sona yürütür: cihaz → kalibrasyon → doğrulama."""
    print("=" * 60)
    print("  ko-macro kurulum")
    print("=" * 60)

    print("\n[1/3] Leonardo aranıyor...")
    device_ok = cmd_devices(args) == 0
    if not device_ok:
        print("\nKart bulunamadı. Firmware yüklü mü? yukle.bat ile yükleyebilirsin.")
        print("Kalibrasyona yine de devam ediliyor.\n")

    print("\n[2/3] Barlar aranıyor...")
    args.write = True
    if cmd_calibrate(args) != 0:
        print("\nKalibrasyon yapılamadı. Oyunu açıp tekrar dene.", file=sys.stderr)
        return 1

    print("\n[3/3] Okuma doğrulanıyor...")
    args.samples = 3
    cmd_vitals(args)

    print("\n" + "=" * 60)
    print("  Sırada ne var")
    print("=" * 60)
    print("1. config.yaml'daki 'skillbar' kısmını kendi tuşlarına göre düzelt")
    print("2. combos           — hangi combo neye basıyor, gör")
    print("3. test \"60-70-72\"  — combo hızını ayarla (gap_ms)")
    print("4. run --watch      — çalıştır")
    if not device_ok:
        print("\nUyarı: Leonardo bulunamadı, tuşlar gönderilemez.")
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
    x, y = args.x, args.y

    if args.oku:
        from .calibrate import MSSScreen
        from .ocr import OcrError

        try:
            config = load_config(_ensure_config(args.config))
            region_x, region_y = _coord_regions(config, args)
            reader = _digit_reader(config)
            x, y = reader.read_coordinates(MSSScreen(), region_x, region_y)
            print(f"ekrandan okunan konum: {x}, {y}")
        except (ConfigError, RuntimeError, OcrError) as exc:
            print(f"konum okunamadı: {exc}", file=sys.stderr)
            return 1

    point = SpawnPoint(
        id=args.id,
        name=args.name or args.id,
        zone=args.zone,
        respawn_min_s=args.min * 60.0,
        respawn_max_s=(args.max if args.max is not None else args.min) * 60.0,
        priority=args.priority,
        notes=args.notes,
        x=x,
        y=y,
    )
    book.add(point)
    book.save()
    where = f"  konum {point.x},{point.y}" if point.position else ""
    print(
        f"eklendi: {point.name} ({point.id}) — doğuş "
        f"{point.respawn_min_s / 60:.0f}-{point.respawn_max_s / 60:.0f} dk{where}"
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

    calibrate = with_config(
        subparsers.add_parser("kalibre", help="barları ekranda otomatik bul")
    )
    calibrate.add_argument("--yaz", "--write", dest="write", action="store_true",
                           help="bulunanları config.yaml'a yaz")
    calibrate.add_argument("--min-width", type=int, default=50,
                           help="bar sayılacak en az genişlik (piksel)")
    calibrate.add_argument("--limit", type=int, default=12, help="kaç aday gösterilsin")
    calibrate.set_defaults(func=cmd_calibrate)

    learn = with_config(
        subparsers.add_parser("mob-ogren", help="seçili mobun adını öğren (filtre için)")
    )
    learn.add_argument("name", help="mobun adı, örn. harpy")
    learn.add_argument("--countdown", type=int, default=5,
                       help="oyuna geçmen için geri sayım (sn)")
    learn.add_argument("--height", type=int, default=18,
                       help="ad şeridinin yüksekliği (piksel)")
    learn.add_argument("--gap", type=int, default=6,
                       help="bar ile ad arasındaki boşluk (piksel)")
    learn.set_defaults(func=cmd_learn_mob)

    learn_coords = with_config(
        subparsers.add_parser("koordinat-ogren", help="ekrandaki koordinat rakamlarını öğret")
    )
    learn_coords.add_argument("x_degeri", help="ekranda yazan X, örn. 512")
    learn_coords.add_argument("y_degeri", help="ekranda yazan Y, örn. 378")
    learn_coords.add_argument("--bolge-x", dest="bolge_x", help="X kutusu: x0,y0,x1,y1")
    learn_coords.add_argument("--bolge-y", dest="bolge_y", help="Y kutusu: x0,y0,x1,y1")
    learn_coords.add_argument("--countdown", type=int, default=5)
    learn_coords.set_defaults(func=cmd_learn_coords)

    coords = with_config(
        subparsers.add_parser("koordinat", help="şu anki koordinatı ekrandan oku")
    )
    coords.add_argument("--bolge-x", dest="bolge_x")
    coords.add_argument("--bolge-y", dest="bolge_y")
    coords.set_defaults(func=cmd_coords)

    setup = with_config(subparsers.add_parser("kur", help="kurulumu baştan sona yürüt"))
    setup.add_argument("--min-width", type=int, default=50)
    setup.add_argument("--limit", type=int, default=12)
    setup.set_defaults(func=cmd_setup, write=True, samples=3)

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
    add.add_argument("--x", type=int, help="oyun içi X konumu")
    add.add_argument("--y", type=int, help="oyun içi Y konumu")
    add.add_argument("--oku", action="store_true",
                     help="konumu ekrandan oku (koordinat-ogren kurulu olmalı)")
    add.add_argument("--bolge-x", dest="bolge_x")
    add.add_argument("--bolge-y", dest="bolge_y")
    add.add_argument("-c", "--config", default="config.yaml")
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
    setup_console()
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
