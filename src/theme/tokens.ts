// Tasarım token'ları: boşluk, köşe, yazı tipi, tipografi, gölge.
//
// ── BU DOSYA 15.09.2026'DA CANLI HÂLE GELDİ ─────────────────────────────────
//
// Eskiden buradaki her şey `as const` ile donmuş sabitlerdi ve dosyanın ilk
// satırı "her tema için aynı (palete göre değişmez)" diyordu. Renk temaya
// bağlıydı ama YAZI TİPİ, BOYUT ve KÖŞE değildi.
//
// NEDEN DEĞİŞTİ. Ürün sahibi dört tasarım yönü arasından "Terminal"i seçti;
// o yönü Terminal yapan şeyin ASIL yarısı renk değil, TEK ARALIKLI YAZI ve
// YOĞUNLUKTU. Yalnız paleti eklediğimde haklı olarak "neden sadece renkleri
// kullandın" dedi. Renk tek başına o tasarım değil.
//
// NASIL ÇALIŞIYOR — VE NEDEN 76 DOSYAYA DOKUNMADAN.
// Ölçüldü (15.09.2026): arayüz dosyalarının **94'ü** stillerini
// `makeStyles(colors)` fabrikasıyla HER RENDER'DA üretiyor; yalnızca **10'u**
// modül düzeyinde donuk `StyleSheet.create` kullanıyor ve bunların **3'ü**
// tipografiye dokunuyordu (Badge, ThemePicker, client-form — üçü de
// fabrikaya çevrildi).
//
// Yani `typography.h3` ifadesi neredeyse her yerde RENDER ANINDA okunuyor.
// Bu yüzden aşağıdaki nesnelerin KİMLİĞİ sabit kalıp İÇERİĞİ değişiyor:
// tema değişince `temaTokenlariniUygula` içeriği tazeliyor, `useTheme`
// aboneleri yeniden çiziliyor ve yeni değerleri okuyorlar.
//
// SIRA KRİTİK: token'lar, store aboneleri haber almadan ÖNCE tazelenmeli —
// bkz. themeStore.setTheme. Ters sırada bir kare eski yazı tipiyle çizilir.
//
// NE DEĞİŞMEZ: Terminal dışındaki beş temada değerler BİREBİR eskisi gibi
// (aşağıdaki VARSAYILAN_* setleri eski sabitlerin aynısıdır). Yani bu
// dosyanın canlılaşması mevcut temalarda hiçbir şeyi oynatmaz.

import type { TextStyle } from 'react-native';
import type { ThemeId } from './palettes';

/* ───────────────────────────── Boşluk ──────────────────────────────────── */

export interface BosLukSeti {
  xxs: number; xs: number; sm: number; md: number;
  lg: number; xl: number; xxl: number; xxxl: number;
}

const VARSAYILAN_BOSLUK: BosLukSeti = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40,
};

// Terminal: ~%25 sıkı. Maketin tezi "aynı ekrana iki katı satır" idi; bunun
// yarısı yazı boyutundan, yarısı boşluktan gelir.
const TERMINAL_BOSLUK: BosLukSeti = {
  xxs: 3, xs: 6, sm: 9, md: 12, lg: 14, xl: 18, xxl: 24, xxxl: 30,
};

/* ───────────────────────────── Köşe ────────────────────────────────────── */

export interface KoseSeti {
  sm: number; md: number; lg: number; xl: number; pill: number;
}

const VARSAYILAN_KOSE: KoseSeti = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Terminal DÜZ bir alettir: yuvarlak köşe "uygulama" hissi verir, maket ise
// kasıtlı olarak kutu/tablo hissi kuruyordu. `pill` 999 kalıyor — rozet ve
// avatar gibi gerçekten yuvarlak olması gereken yerler var.
const TERMINAL_KOSE: KoseSeti = { sm: 2, md: 3, lg: 4, xl: 6, pill: 999 };

/* ───────────────────────────── Yazı tipi ───────────────────────────────── */

export interface YaziTipiSeti {
  regular: string; medium: string; semibold: string;
  bold: string; extrabold: string;
  /** Marka yazısı — HİÇBİR TEMADA değişmez. */
  script: string;
}

// Gövde Manrope (kurumsal, Türkçe destekli), marka yazısı Dancing Script.
// Ağırlık başına ayrı dosya; font yüklenemezse sistem fontu + fontWeight
// devreye girer (güvenli düşüş).
const VARSAYILAN_YAZI: YaziTipiSeti = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  script: 'DancingScript_700Bold',
};

// JetBrains Mono — maketin kullandığı yazı tipinin ta kendisi (dört yön
// karşılaştırmasında Google Fonts'tan yükleniyordu, yani ürün sahibinin
// gördüğü şey buydu, sistem yedeği değil). Latin Extended kapsıyor: ı İ ş ğ
// ç ö ü hepsi var — render edilerek doğrulandı.
const TERMINAL_YAZI: YaziTipiSeti = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  bold: 'JetBrainsMono_700Bold',
  extrabold: 'JetBrainsMono_800ExtraBold',
  script: 'DancingScript_700Bold', // marka yazısı mono OLMAZ
};

/* ───────────────────────────── Tipografi ───────────────────────────────── */

export type TipografiAnahtari =
  | 'display' | 'h1' | 'h2' | 'h3'
  | 'body' | 'bodyMedium' | 'caption' | 'small';

export type TipografiSeti = Record<TipografiAnahtari, TextStyle>;

const VARSAYILAN_TIPOGRAFI: TipografiSeti = {
  display: { fontSize: 30, fontFamily: VARSAYILAN_YAZI.bold, fontWeight: '700', letterSpacing: -0.5 },
  h1: { fontSize: 24, fontFamily: VARSAYILAN_YAZI.bold, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 20, fontFamily: VARSAYILAN_YAZI.bold, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 17, fontFamily: VARSAYILAN_YAZI.semibold, fontWeight: '600' },
  body: { fontSize: 15, fontFamily: VARSAYILAN_YAZI.regular, fontWeight: '400' },
  bodyMedium: { fontSize: 15, fontFamily: VARSAYILAN_YAZI.semibold, fontWeight: '600' },
  caption: { fontSize: 13, fontFamily: VARSAYILAN_YAZI.medium, fontWeight: '500' },
  small: { fontSize: 11, fontFamily: VARSAYILAN_YAZI.semibold, fontWeight: '600', letterSpacing: 0.4 },
};

// Tek aralıklı yazı karakter başına DAHA GENİŞ yer kaplar (maketin kendi
// "zayıf" listesinde de yazıyordu: "uzun Türkçe başlıklarda geniş yer
// kaplıyor"). Bu yüzden boyutlar küçültülmeden mono'ya geçmek ekranı
// daraltırdı — yoğunlaştırmaz, tam tersini yapardı.
// Taban 13 px: maketin 12,5 px'ine yakın ama hukuk metni için okunur.
// letterSpacing 0: mono zaten aralıklı, üstüne eklemek dağıtıyor.
const TERMINAL_TIPOGRAFI: TipografiSeti = {
  display: { fontSize: 24, fontFamily: TERMINAL_YAZI.bold, fontWeight: '700', letterSpacing: 0 },
  h1: { fontSize: 19, fontFamily: TERMINAL_YAZI.bold, fontWeight: '700', letterSpacing: 0 },
  h2: { fontSize: 16, fontFamily: TERMINAL_YAZI.bold, fontWeight: '700', letterSpacing: 0 },
  h3: { fontSize: 14, fontFamily: TERMINAL_YAZI.semibold, fontWeight: '600' },
  body: { fontSize: 13, fontFamily: TERMINAL_YAZI.regular, fontWeight: '400' },
  bodyMedium: { fontSize: 13, fontFamily: TERMINAL_YAZI.medium, fontWeight: '500' },
  caption: { fontSize: 12, fontFamily: TERMINAL_YAZI.regular, fontWeight: '400' },
  small: { fontSize: 10, fontFamily: TERMINAL_YAZI.medium, fontWeight: '500', letterSpacing: 0.6 },
};

/* ──────────────────── Canlı token'lar (kimlik sabit) ───────────────────── */

export const spacing: BosLukSeti = { ...VARSAYILAN_BOSLUK };
export const radius: KoseSeti = { ...VARSAYILAN_KOSE };
export const fonts: YaziTipiSeti = { ...VARSAYILAN_YAZI };
export const typography: TipografiSeti = kopyala(VARSAYILAN_TIPOGRAFI);

/**
 * Aktif tema TEK ARALIKLI mı?
 *
 * Bazı ekranlar token'ların dışında, doğrudan bir yazı tipi adı yazıyor —
 * panodaki Playfair Display serif başlıklar gibi. Bunlar "her temada zarif"
 * varsayımıyla yazılmıştı; Terminal temasında zarif serif başlık, mono
 * gövdenin yanında yamalı duruyor. Kod o yazı tipini seçerken bu bayrağa
 * bakmalı — yazı tipi ADINI karşılaştırmak yerine, çünkü ad değişebilir.
 *
 * Fonksiyon, sabit değil: render anında okunmalı (tema sonradan değişiyor).
 */
export function monoTemaMi(): boolean {
  return _monoTema;
}
let _monoTema = false;

/** Terminal temasında hiçbir köşe bundan yuvarlak olamaz. */
const TERMINAL_KOSE_TAVANI = 4;

/**
 * SABİT YAZILMIŞ KÖŞE YARIÇAPINI TEMAYA UYDUR.
 *
 * ÖLÇÜLDÜ (15.09.2026): depoda **314 satırda** `borderRadius: <sayı>` var
 * (71 dosya) — bunlar `radius` token'ını hiç kullanmıyor. Terminal teması
 * token'ları düzleştirince bu 314 yer yuvarlak kaldı ve ekran yarı düz yarı
 * yuvarlak, yamalı göründü: "Gelir Ekle" düğmesi hâlâ hap biçimindeyken
 * yanındaki kart köşeliydi.
 *
 * 314 yeri elle token'a çevirmek yerine hepsi buradan geçiriliyor. Bunun iki
 * faydası var: (1) dönüşüm mekanik ve aynı, yani gözden kaçan yer olmuyor;
 * (2) Terminal DIŞINDA fonksiyon birebir girdiyi döndürüyor — yani beş
 * temada tek piksel oynamıyor, bu bir yenileme değil ekleme.
 *
 * 999 ve üstü dokunulmadan geçer: orası "gerçekten daire" demek (avatar,
 * durum noktası, yuvarlak ikon düğmesi) ve köşeli olursa bozuk görünür.
 */
export function kose(px: number): number {
  if (!_monoTema || px >= 999) return px;
  return Math.min(px, TERMINAL_KOSE_TAVANI);
}

/**
 * Aktif temanın ölçü token'larını yerleştirir.
 *
 * `Object.assign` ile İÇERİK tazeleniyor, nesne YENİDEN OLUŞTURULMUYOR:
 * 94 dosya bu nesneleri modül düzeyinde import edip render anında okuyor;
 * yeni bir nesne atasak o dosyaların elindeki referans eskisini göstermeye
 * devam ederdi.
 */
export function temaTokenlariniUygula(temaId: ThemeId): void {
  const terminal = temaId === 'terminal';
  _monoTema = terminal;
  Object.assign(spacing, terminal ? TERMINAL_BOSLUK : VARSAYILAN_BOSLUK);
  Object.assign(radius, terminal ? TERMINAL_KOSE : VARSAYILAN_KOSE);
  Object.assign(fonts, terminal ? TERMINAL_YAZI : VARSAYILAN_YAZI);
  const kaynak = terminal ? TERMINAL_TIPOGRAFI : VARSAYILAN_TIPOGRAFI;
  for (const anahtar of Object.keys(kaynak) as TipografiAnahtari[]) {
    // Her stil AYRI bir nesne: `...typography.h3` yayması yapan yerler
    // içeriği kopyalıyor, o yüzden iç nesneleri de tazelemek gerekiyor.
    typography[anahtar] = { ...kaynak[anahtar] };
  }
}

/** Testler ve ölçüm için: bir temanın token setini yan etkisiz okumak. */
export function temaTokenlari(temaId: ThemeId): {
  spacing: BosLukSeti; radius: KoseSeti; fonts: YaziTipiSeti; typography: TipografiSeti;
} {
  const terminal = temaId === 'terminal';
  return {
    spacing: { ...(terminal ? TERMINAL_BOSLUK : VARSAYILAN_BOSLUK) },
    radius: { ...(terminal ? TERMINAL_KOSE : VARSAYILAN_KOSE) },
    fonts: { ...(terminal ? TERMINAL_YAZI : VARSAYILAN_YAZI) },
    typography: kopyala(terminal ? TERMINAL_TIPOGRAFI : VARSAYILAN_TIPOGRAFI),
  };
}

function kopyala(s: TipografiSeti): TipografiSeti {
  return Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, { ...v }]),
  ) as TipografiSeti;
}

/* ───────────────────────────── Gölge ───────────────────────────────────── */

export const shadow = {
  card: {
    shadowColor: '#1A2C51',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: '#1A2C51',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
