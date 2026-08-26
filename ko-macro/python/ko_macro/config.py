"""YAML konfigürasyonu ve veri modelleri.

Tüm ayarlar tek bir ``config.yaml`` dosyasından okunur. Sınıf profilleri
(``profiles/archer.yaml``, ``profiles/priest.yaml``) aynı şemayı kullanır ve
``profile:`` alanıyla ana config'in üstüne bindirilir.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .autocast import AutoCastRule
from .keys import normalize_button, normalize_key
from .paths import profile_dir


class ConfigError(ValueError):
    """Config dosyası eksik ya da hatalı."""


# --------------------------------------------------------------------- adımlar


@dataclass
class ComboStep:
    """Combo içindeki tek hareket.

    ``skill`` verilirse skillbar üzerinden tuşa çevrilir, ``key`` verilirse
    doğrudan o tuşa basılır, ``button`` verilirse fare tıklanır.
    """

    key: str | None = None
    skill: str | None = None
    button: str | None = None
    hold_ms: int = 40
    gap_ms: int = 120
    repeat: int = 1
    label: str = ""

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ComboStep":
        if not isinstance(raw, dict):
            raise ConfigError(f"combo adımı sözlük olmalı, gelen: {raw!r}")
        step = cls(
            key=raw.get("key"),
            skill=raw.get("skill"),
            button=raw.get("button"),
            hold_ms=int(raw.get("hold_ms", 40)),
            gap_ms=int(raw.get("gap_ms", 120)),
            repeat=int(raw.get("repeat", 1)),
            label=str(raw.get("label", "")),
        )
        if sum(x is not None for x in (step.key, step.skill, step.button)) != 1:
            raise ConfigError(
                f"combo adımında tam olarak biri olmalı - key / skill / button: {raw!r}"
            )
        if step.repeat < 1:
            raise ConfigError(f"repeat en az 1 olmalı: {raw!r}")
        if step.hold_ms < 1:
            raise ConfigError(f"hold_ms en az 1 olmalı: {raw!r}")
        if step.gap_ms < 0:
            raise ConfigError(f"gap_ms negatif olamaz: {raw!r}")
        if step.button is not None:
            normalize_button(step.button)
        if step.key is not None:
            step.key = normalize_key(step.key)
        return step

    def resolve_key(self, skillbar: dict[str, str]) -> str | None:
        """Adımın basacağı tuşu döndürür (fare adımıysa ``None``)."""
        if self.button is not None:
            return None
        if self.key is not None:
            return self.key
        assert self.skill is not None
        if self.skill not in skillbar:
            raise ConfigError(
                f"skillbar'da tanımsız yetenek: {self.skill!r} "
                f"(tanımlı olanlar: {', '.join(sorted(skillbar)) or 'yok'})"
            )
        return normalize_key(skillbar[self.skill])

    @property
    def display(self) -> str:
        return self.label or self.skill or self.key or f"fare:{self.button}"


@dataclass
class Combo:
    """Hotkey'e bağlanabilen isimli bir adım dizisi."""

    name: str
    steps: list[ComboStep] = field(default_factory=list)
    hotkey: str | None = None
    cooldown_ms: int = 0
    repeat: int = 1
    loop: bool = False
    burst: bool = True
    description: str = ""
    #: Combo bitince duruşa (okçuda Z) geri dön. Bazı skill dizileri karakteri
    #: duruştan çıkarıyor; bu, sonuna duruş tuşunu ekler.
    restore_stance: bool = False

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Combo":
        if not isinstance(raw, dict) or "name" not in raw:
            raise ConfigError(f"combo tanımı 'name' içermeli: {raw!r}")
        steps = [ComboStep.from_dict(s) for s in raw.get("steps", [])]
        if not steps:
            raise ConfigError(f"{raw['name']!r} combosunda hiç adım yok")
        hotkey = raw.get("hotkey")
        return cls(
            name=str(raw["name"]),
            steps=steps,
            hotkey=normalize_key(hotkey) if hotkey else None,
            cooldown_ms=int(raw.get("cooldown_ms", 0)),
            repeat=int(raw.get("repeat", 1)),
            loop=bool(raw.get("loop", False)),
            burst=bool(raw.get("burst", True)),
            description=str(raw.get("description", "")),
            restore_stance=bool(raw.get("restore_stance", False)),
        )

    def duration_ms(self) -> int:
        """Tek turun toplam süresi."""
        return sum((step.hold_ms + step.gap_ms) * step.repeat for step in self.steps)


# ------------------------------------------------------------------- can/mana


@dataclass
class BarRegion:
    """Ekrandaki can/mana barının okunacağı şerit.

    Bar soldan sağa dolduğu için ``y`` sabit tutulup ``x0..x1`` arası
    örneklenir; dolu piksel oranı bar yüzdesini verir.
    """

    x0: int = 0
    y: int = 0
    x1: int = 0
    samples: int = 24
    #: Dolu sayılacak rengin RGB'si ve tolerans yarıçapı.
    color: tuple[int, int, int] = (168, 32, 32)
    tolerance: int = 60

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "BarRegion":
        color = raw.get("color", [168, 32, 32])
        if len(color) != 3:
            raise ConfigError(f"color 3 elemanlı RGB olmalı: {color!r}")
        region = cls(
            x0=int(raw.get("x0", 0)),
            y=int(raw.get("y", 0)),
            x1=int(raw.get("x1", 0)),
            samples=int(raw.get("samples", 24)),
            color=(int(color[0]), int(color[1]), int(color[2])),
            tolerance=int(raw.get("tolerance", 60)),
        )
        if region.x1 <= region.x0:
            raise ConfigError("bar bölgesinde x1 > x0 olmalı")
        if region.samples < 2:
            raise ConfigError("samples en az 2 olmalı")
        return region


@dataclass
class PotionRule:
    """Belirli bir eşiğin altına inince basılacak tuş."""

    below_pct: float
    key: str
    cooldown_ms: int = 1200
    label: str = ""

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PotionRule":
        return cls(
            below_pct=float(raw["below_pct"]),
            key=normalize_key(raw["key"]),
            cooldown_ms=int(raw.get("cooldown_ms", 1200)),
            label=str(raw.get("label", "")),
        )


@dataclass
class VitalsConfig:
    """Piksel okuyarak can/mana takibi."""

    enabled: bool = False
    poll_ms: int = 120
    hp: BarRegion | None = None
    mp: BarRegion | None = None
    hp_potions: list[PotionRule] = field(default_factory=list)
    mp_potions: list[PotionRule] = field(default_factory=list)
    #: Bu yüzdenin altında combo çalıştırma, önce iyileş.
    pause_combo_below_hp: float = 0.0

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "VitalsConfig":
        raw = raw or {}
        return cls(
            enabled=bool(raw.get("enabled", False)),
            poll_ms=int(raw.get("poll_ms", 120)),
            hp=BarRegion.from_dict(raw["hp"]) if raw.get("hp") else None,
            mp=BarRegion.from_dict(raw["mp"]) if raw.get("mp") else None,
            hp_potions=[PotionRule.from_dict(p) for p in raw.get("hp_potions", [])],
            mp_potions=[PotionRule.from_dict(p) for p in raw.get("mp_potions", [])],
            pause_combo_below_hp=float(raw.get("pause_combo_below_hp", 0.0)),
        )


# ------------------------------------------------------------------ farm/döngü


@dataclass
class FarmConfig:
    """Otomatik hedef seç → vur → yağmala döngüsü."""

    enabled: bool = False
    target_key: str = "tab"
    attack_key: str | None = None
    attack_button: str | None = "left"
    combo: str | None = None
    engage_seconds: float = 12.0
    retarget_delay_ms: int = 350
    loot_key: str | None = None
    loot_repeat: int = 3
    #: Hedef bulunamadığında karakteri hafifçe döndürüp yeniden dener.
    search_turn_key: str | None = "right"
    search_turn_ms: int = 220
    #: Öldürülen mobu doğuş takipçisine yazarken kullanılacak nokta.
    spawn_point: str | None = None
    #: Ekranın üstündeki hedef can barı. Tanımlıysa döngü kör çalışmaz:
    #: hedef seçildi mi, can azalıyor mu, öldü mü — hepsi buradan okunur.
    target_bar: BarRegion | None = None
    #: Tab'a bastıktan sonra hedef barının belirmesi için tanınan süre.
    acquire_timeout_ms: int = 900
    #: Hedef bulunamazsa kaç kez çevirip yeniden denenecek.
    search_attempts: int = 6
    #: Bu kadar süre hasar girmezse (menzil dışı/ıska) hedef bırakılır.
    stall_seconds: float = 4.0
    #: Hedef barı okuma sıklığı.
    poll_ms: int = 100
    #: Hedefin canı bu yüzdenin altındaysa taze sayılmaz ve atlanır.
    #: Tab en yakındakini seçtiği için ceset (bar boş) ve başkasının dövdüğü
    #: mob (bar yarım) buradan eleniyor. 0 = eleme yapma.
    min_target_hp_pct: float = 90.0
    #: Kaç başarısız Tab denemesinden sonra karakter çevrilsin.
    turn_after_attempts: int = 2
    #: Mob öldükten sonra Tab'a basmadan önce beklenecek süre — ceset bir an
    #: daha seçilebilir kaldığı için hemen basmak yine cesedi seçtirir.
    post_kill_delay_ms: int = 250
    #: Hedef adının ekranda yazıldığı bölge. Tanımlıysa ve ``mob_names``
    #: doluysa, sadece o adlara benzeyen hedefler dövülür.
    name_region: dict[str, Any] | None = None
    #: Kabul edilen mob adları: görünen ad -> parmak izi. ``mob-ogren``
    #: komutu doldurur.
    mob_names: dict[str, str] = field(default_factory=dict)
    #: Ad eşleşmesi için gereken en az benzerlik (0-1).
    name_threshold: float = 0.85
    #: Hedefleme kipi: ``tab`` oyunun Tab'ını kullanır, ``click`` ekranda mob
    #: isim etiketlerini arayıp üstüne tıklar. ``click`` görüş alanındaki
    #: moblar arasından seçebilir; Tab tek hedef verir.
    targeting: str = "tab"
    #: Etiket taraması ayarları (``mobscan.ScanSettings`` biçiminde).
    scan: dict[str, Any] | None = None
    #: Tıkladıktan sonra hedefin oturması için beklenecek süre.
    click_settle_ms: int = 220

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "FarmConfig":
        raw = raw or {}
        farm = cls(
            enabled=bool(raw.get("enabled", False)),
            target_key=normalize_key(raw.get("target_key", "tab")),
            attack_key=normalize_key(raw["attack_key"]) if raw.get("attack_key") else None,
            attack_button=(
                normalize_button(raw["attack_button"]) if raw.get("attack_button") else None
            ),
            combo=raw.get("combo"),
            engage_seconds=float(raw.get("engage_seconds", 12.0)),
            retarget_delay_ms=int(raw.get("retarget_delay_ms", 350)),
            loot_key=normalize_key(raw["loot_key"]) if raw.get("loot_key") else None,
            loot_repeat=int(raw.get("loot_repeat", 3)),
            search_turn_key=(
                normalize_key(raw["search_turn_key"]) if raw.get("search_turn_key") else None
            ),
            search_turn_ms=int(raw.get("search_turn_ms", 220)),
            spawn_point=raw.get("spawn_point"),
            target_bar=BarRegion.from_dict(raw["target_bar"]) if raw.get("target_bar") else None,
            acquire_timeout_ms=int(raw.get("acquire_timeout_ms", 900)),
            search_attempts=int(raw.get("search_attempts", 6)),
            stall_seconds=float(raw.get("stall_seconds", 4.0)),
            poll_ms=int(raw.get("poll_ms", 100)),
            min_target_hp_pct=float(raw.get("min_target_hp_pct", 90.0)),
            turn_after_attempts=int(raw.get("turn_after_attempts", 2)),
            post_kill_delay_ms=int(raw.get("post_kill_delay_ms", 250)),
            name_region=raw.get("name_region"),
            mob_names={str(k): str(v) for k, v in (raw.get("mob_names") or {}).items()},
            name_threshold=float(raw.get("name_threshold", 0.85)),
            targeting=str(raw.get("targeting", "tab")).lower(),
            scan=raw.get("scan"),
            click_settle_ms=int(raw.get("click_settle_ms", 220)),
        )
        if farm.engage_seconds <= 0:
            raise ConfigError("engage_seconds pozitif olmalı")
        if farm.search_attempts < 1:
            raise ConfigError("search_attempts en az 1 olmalı")
        if not 0 <= farm.min_target_hp_pct <= 100:
            raise ConfigError("min_target_hp_pct 0-100 arasında olmalı")
        if farm.turn_after_attempts < 1:
            raise ConfigError("turn_after_attempts en az 1 olmalı")
        if not 0 < farm.name_threshold <= 1:
            raise ConfigError("name_threshold 0 ile 1 arasında olmalı")
        if farm.mob_names and not farm.name_region:
            raise ConfigError(
                "mob_names tanımlı ama name_region yok — 'mob-ogren' komutuyla ikisini "
                "birlikte oluştur"
            )
        if farm.targeting not in {"tab", "click"}:
            raise ConfigError(
                f"farm.targeting 'tab' ya da 'click' olmalı, gelen: {farm.targeting!r}"
            )
        if farm.targeting == "click" and farm.target_bar is None:
            raise ConfigError(
                "farm.targeting: click için target_bar gerekli — tıklamanın hedef "
                "seçip seçmediğini bar okumadan doğrulayamayız"
            )
        if farm.scan is not None:
            from .mobscan import ScanSettings  # döngüsel import olmasın diye burada

            try:
                ScanSettings.from_dict(farm.scan)
            except (KeyError, ValueError) as exc:
                raise ConfigError(f"farm.scan hatalı: {exc}") from exc
        if farm.name_region:
            from .nameplate import NameRegion  # döngüsel import olmasın diye burada

            try:
                NameRegion.from_dict(farm.name_region)
            except (KeyError, ValueError) as exc:
                raise ConfigError(f"name_region hatalı: {exc}") from exc
        return farm


# --------------------------------------------------------------- yardımcı işler


@dataclass
class UtilityConfig:
    """Upgrade, tamir, anti-AFK gibi tek amaçlı makrolar."""

    #: Anvil'de tıklama makrosu: (tuş listesi, tur arası bekleme).
    upgrade_keys: list[str] = field(default_factory=list)
    upgrade_speed_ms: int = 220
    upgrade_rounds: int = 1
    #: Magic hammer / tamir dizisi.
    repair_keys: list[str] = field(default_factory=list)
    repair_speed_ms: int = 350
    #: Anti-AFK: verilen aralıkla mob'a tıklar / tuşa basar.
    anti_afk_interval_s: float = 120.0
    anti_afk_key: str | None = None
    anti_afk_click: str | None = "left"
    #: Descent (iniş) tuşu.
    descent_key: str | None = None
    #: Ekipman setleri: ad -> tuş dizisi.
    equipment_sets: dict[str, list[str]] = field(default_factory=dict)
    equipment_speed_ms: int = 180
    #: Yardımcı makro adı -> kısayol tuşu (örn. {"repair": "f7"}).
    hotkeys: dict[str, str] = field(default_factory=dict)

    def available_names(self) -> set[str]:
        """Config'de gerçekten tanımlı olan yardımcı makroların adları.

        ``autocast`` ve kısayol doğrulaması buna bakar; böylece olmayan bir
        makroya kural yazıldığında hata çalışma anında değil yüklemede çıkar.
        """
        names: set[str] = set()
        if self.upgrade_keys:
            names.add("upgrade")
        if self.repair_keys:
            names.add("repair")
        if self.descent_key:
            names.add("descent")
        names.update(f"equip:{name}" for name in self.equipment_sets)
        return names

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "UtilityConfig":
        raw = raw or {}
        sets = {
            str(name): [normalize_key(k) for k in keys]
            for name, keys in (raw.get("equipment_sets") or {}).items()
        }
        return cls(
            upgrade_keys=[normalize_key(k) for k in raw.get("upgrade_keys", [])],
            upgrade_speed_ms=int(raw.get("upgrade_speed_ms", 220)),
            upgrade_rounds=int(raw.get("upgrade_rounds", 1)),
            repair_keys=[normalize_key(k) for k in raw.get("repair_keys", [])],
            repair_speed_ms=int(raw.get("repair_speed_ms", 350)),
            anti_afk_interval_s=float(raw.get("anti_afk_interval_s", 120.0)),
            anti_afk_key=(
                normalize_key(raw["anti_afk_key"]) if raw.get("anti_afk_key") else None
            ),
            anti_afk_click=(
                normalize_button(raw["anti_afk_click"]) if raw.get("anti_afk_click") else None
            ),
            descent_key=normalize_key(raw["descent_key"]) if raw.get("descent_key") else None,
            equipment_sets=sets,
            equipment_speed_ms=int(raw.get("equipment_speed_ms", 180)),
            hotkeys={
                str(name): normalize_key(key)
                for name, key in (raw.get("hotkeys") or {}).items()
            },
        )


# ------------------------------------------------------------------- kök config


@dataclass
class CoordsConfig:
    """Oyunun arayüzünde yazan konum bilgisini ekrandan okuma.

    Oyun sürecine dokunulmaz; sadece rakamların piksel görüntüsü tanınır.
    ``koordinat-ogren`` komutu bu bölümü kendisi doldurur.
    """

    #: X ve Y sayılarının yazıldığı bölgeler (``ocr.TextRegion`` biçiminde).
    #: Ayrı kutular: tek kutudan iki sayıyı boşluğa bakarak ayırmak dar
    #: rakamlarda sessizce yanlış sonuç veriyor.
    region_x: dict[str, Any] | None = None
    region_y: dict[str, Any] | None = None
    #: Öğretilmiş rakam kalıpları: '0'-'9' -> imza.
    glyphs: dict[str, str] = field(default_factory=dict)
    #: Eşleşme için gereken en az benzerlik.
    threshold: float = 0.88

    @property
    def enabled(self) -> bool:
        return bool(self.region_x and self.region_y and self.glyphs)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CoordsConfig":
        raw = raw or {}
        config = cls(
            region_x=raw.get("region_x"),
            region_y=raw.get("region_y"),
            glyphs={str(k): str(v) for k, v in (raw.get("glyphs") or {}).items()},
            threshold=float(raw.get("threshold", 0.88)),
        )
        if not 0 < config.threshold <= 1:
            raise ConfigError("coords.threshold 0 ile 1 arasında olmalı")

        from .ocr import TextRegion  # döngüsel import olmasın diye burada

        for name in ("region_x", "region_y"):
            raw_region = getattr(config, name)
            if raw_region is None:
                continue
            try:
                TextRegion.from_dict(raw_region)
            except (KeyError, ValueError) as exc:
                raise ConfigError(f"coords.{name} hatalı: {exc}") from exc
        return config


@dataclass
class TransportConfig:
    kind: str = "leonardo"
    port: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "TransportConfig":
        raw = raw or {}
        return cls(kind=str(raw.get("kind", "leonardo")), port=raw.get("port"))


@dataclass
class TimingConfig:
    """İnsani düzensizlik ayarları."""

    #: Her gecikmeye uygulanacak ± yüzde.
    jitter_pct: float = 8.0
    #: Combo tekrarları arasındaki taban bekleme.
    combo_gap_ms: int = 90
    #: Tuş basılı kalma süresine uygulanacak ± yüzde.
    hold_jitter_pct: float = 15.0

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "TimingConfig":
        raw = raw or {}
        timing = cls(
            jitter_pct=float(raw.get("jitter_pct", 8.0)),
            combo_gap_ms=int(raw.get("combo_gap_ms", 90)),
            hold_jitter_pct=float(raw.get("hold_jitter_pct", 15.0)),
        )
        if not 0 <= timing.jitter_pct < 100:
            raise ConfigError("jitter_pct 0-100 arasında olmalı")
        if not 0 <= timing.hold_jitter_pct < 100:
            raise ConfigError("hold_jitter_pct 0-100 arasında olmalı")
        return timing


@dataclass
class HotkeyConfig:
    """Global kısayollar."""

    start_stop: str = "f9"
    panic: str = "f12"
    mark_kill: str | None = "f11"
    toggle_farm: str | None = "f10"

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "HotkeyConfig":
        raw = raw or {}
        def opt(name: str, default: str | None) -> str | None:
            value = raw.get(name, default)
            return normalize_key(value) if value else None

        return cls(
            start_stop=normalize_key(raw.get("start_stop", "f9")),
            panic=normalize_key(raw.get("panic", "f12")),
            mark_kill=opt("mark_kill", "f11"),
            toggle_farm=opt("toggle_farm", "f10"),
        )


@dataclass
class AppConfig:
    """Kök konfigürasyon."""

    transport: TransportConfig = field(default_factory=TransportConfig)
    timing: TimingConfig = field(default_factory=TimingConfig)
    hotkeys: HotkeyConfig = field(default_factory=HotkeyConfig)
    skillbar: dict[str, str] = field(default_factory=dict)
    combos: list[Combo] = field(default_factory=list)
    vitals: VitalsConfig = field(default_factory=VitalsConfig)
    farm: FarmConfig = field(default_factory=FarmConfig)
    utility: UtilityConfig = field(default_factory=UtilityConfig)
    coords: CoordsConfig = field(default_factory=CoordsConfig)
    autocast: list["AutoCastRule"] = field(default_factory=list)
    #: Duruş tuşu (okçuda Z). ``restore_stance`` olan combolar sonunda buna basar.
    stance_key: str | None = None
    #: Duruş tuşuna basmadan önceki bekleme.
    stance_delay_ms: int = 120
    spawn_file: str = "spawns.json"
    profile_name: str = ""

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AppConfig":
        skillbar = {
            str(name): normalize_key(key)
            for name, key in (raw.get("skillbar") or {}).items()
        }
        combos = [Combo.from_dict(c) for c in raw.get("combos", [])]

        names = [combo.name for combo in combos]
        duplicates = {name for name in names if names.count(name) > 1}
        if duplicates:
            raise ConfigError(f"aynı isimde birden fazla combo: {', '.join(sorted(duplicates))}")

        try:
            autocast = [AutoCastRule.from_dict(rule) for rule in raw.get("autocast", [])]
        except (KeyError, ValueError) as exc:
            raise ConfigError(f"autocast kuralı hatalı: {exc}") from exc

        stance_key = raw.get("stance_key")
        config = cls(
            transport=TransportConfig.from_dict(raw.get("transport", {})),
            timing=TimingConfig.from_dict(raw.get("timing", {})),
            hotkeys=HotkeyConfig.from_dict(raw.get("hotkeys", {})),
            skillbar=skillbar,
            combos=combos,
            vitals=VitalsConfig.from_dict(raw.get("vitals", {})),
            farm=FarmConfig.from_dict(raw.get("farm", {})),
            utility=UtilityConfig.from_dict(raw.get("utility", {})),
            coords=CoordsConfig.from_dict(raw.get("coords", {})),
            autocast=autocast,
            stance_key=normalize_key(stance_key) if stance_key else None,
            stance_delay_ms=int(raw.get("stance_delay_ms", 120)),
            spawn_file=str(raw.get("spawn_file", "spawns.json")),
            profile_name=str(raw.get("profile", "")),
        )
        config.validate()
        return config

    def validate(self) -> None:
        """Combolardaki skill adlarının ve farm referanslarının varlığını doğrular."""
        for combo in self.combos:
            for step in combo.steps:
                step.resolve_key(self.skillbar)
        if self.farm.combo and self.find_combo(self.farm.combo) is None:
            raise ConfigError(f"farm.combo tanımsız bir comboyu gösteriyor: {self.farm.combo!r}")

        hotkeys = [combo.hotkey for combo in self.combos if combo.hotkey]
        clashing = {key for key in hotkeys if hotkeys.count(key) > 1}
        if clashing:
            raise ConfigError(f"aynı hotkey birden fazla comboda: {', '.join(sorted(clashing))}")

        utility_names = self.utility.available_names()
        for rule in self.autocast:
            if rule.combo and self.find_combo(rule.combo) is None:
                if rule.combo not in utility_names:
                    known = sorted({combo.name for combo in self.combos} | utility_names)
                    raise ConfigError(
                        f"autocast kuralı {rule.name!r} tanımsız bir comboyu gösteriyor: "
                        f"{rule.combo!r} (tanımlı: {', '.join(known) or 'yok'})"
                    )
            if rule.key:
                rule.key = normalize_key(rule.key)

        # Kontrol kısayolları da doluysa çakışma sayılır; yoksa yardımcı makro
        # sessizce bağlanamadan kalırdı.
        control_keys = {
            key
            for key in (
                self.hotkeys.start_stop,
                self.hotkeys.panic,
                self.hotkeys.mark_kill,
                self.hotkeys.toggle_farm,
            )
            if key
        }
        for name, key in self.utility.hotkeys.items():
            if name not in utility_names:
                raise ConfigError(
                    f"utility.hotkeys tanımsız bir makroyu gösteriyor: {name!r} "
                    f"(tanımlı: {', '.join(sorted(utility_names)) or 'yok'})"
                )
            if key in hotkeys:
                raise ConfigError(f"utility kısayolu bir comboyla çakışıyor: {key}")
            if key in control_keys:
                raise ConfigError(f"utility kısayolu bir kontrol tuşuyla çakışıyor: {key}")

        if any(combo.restore_stance for combo in self.combos) and not self.stance_key:
            raise ConfigError(
                "restore_stance kullanan combo var ama 'stance_key' tanımlı değil"
            )

    def find_combo(self, name: str) -> Combo | None:
        for combo in self.combos:
            if combo.name.lower() == str(name).lower():
                return combo
        return None


# ------------------------------------------------------------------ yükleyiciler


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    """``overlay`` değerlerini ``base`` üstüne bindirir (listeler değiştirilir)."""
    merged = copy.deepcopy(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def read_yaml(path: str | Path) -> dict[str, Any]:
    """YAML dosyasını sözlük olarak okur."""
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover - ortama bağlı
        raise ConfigError("pyyaml kurulu değil: pip install pyyaml") from exc

    file_path = Path(path)
    if not file_path.is_file():
        raise ConfigError(f"config dosyası yok: {file_path}")
    data = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ConfigError(f"{file_path} kök seviyede sözlük olmalı")
    return data


def available_profiles() -> list[str]:
    """``profiles/`` altındaki sınıf profillerinin adları."""
    directory = profile_dir()
    if not directory.is_dir():
        return []
    return sorted(path.stem for path in directory.glob("*.yaml"))


def load_config(path: str | Path) -> AppConfig:
    """Config'i (varsa sınıf profiliyle birleştirerek) yükler.

    Profil taban katmandır; ana config dosyası onun üstüne yazar. Böylece
    hazır combo setini bozmadan sadece kendi tuş dizilimini geçebilirsin.
    """
    raw = read_yaml(path)
    profile_name = raw.get("profile")
    if profile_name:
        profile_path = profile_dir() / f"{profile_name}.yaml"
        if not profile_path.is_file():
            raise ConfigError(
                f"profil bulunamadı: {profile_name!r} "
                f"(mevcut: {', '.join(available_profiles()) or 'yok'})"
            )
        raw = _deep_merge(read_yaml(profile_path), raw)
        raw["profile"] = profile_name
    return AppConfig.from_dict(raw)
