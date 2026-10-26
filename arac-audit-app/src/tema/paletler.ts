// RENK PALETLERİ — iki tema: açık ve koyu.
//
// NEDEN İKİ TEMA, BEŞ DEĞİL: bu bir alet, bir tüketici uygulaması değil.
// Denetçi gün ışığı alan bir sevk sahasında da, loş bir final hattında da
// çalışır; ihtiyaç bu ikisidir. Her tema fazlası, her renk kararını beş kere
// doğrulamak demektir.
//
// KURAL: bileşen dosyalarında ÇIPLAK HEX YAZMA. Renk her zaman temadan gelir,
// yoksa iki temanın birinde sessizce okunmaz olur.
//
// Vurgu rengi neden mavi: şiddet sınıfları kırmızı/turuncu/sarıyı ZATEN
// tutuyor. Vurgu bunlarla çarpışmamalı, yoksa "kritik hata" ile "birincil
// düğme" aynı sinyali verir.
//
// 25.10.2026: açık tema Vekil Pro'nun "Klasik" paletine çekildi (bg #EEF2F8,
// birincil #173C7E, çizgi #CFD9EA). Gerekçe: ürün sahibi iki yenilemeyi de
// beğenmedi ("dandik", "arayüz beğenmedim"); Vekil Pro onun onayladığı tek
// görsel dil. Koyu uygulama çubuğu kaldırıldı — başlık artık sayfa zemininde.
// Soluk metin Vekil'den koyu (#828EA6 → #56657F): oradaki değer 13 px yazıda
// 3,3:1 kalıyor, bu uygulama güneş altında kullanılıyor; ≥ 4,5:1 şart.

export type TemaAdi = 'acik' | 'koyu';

export interface Renkler {
  // Yüzeyler
  bg: string;
  bgYukseltilmis: string;
  yuzey: string;
  yuzeyAlt: string;
  yuzeyVurgu: string;

  // Çizgiler
  cizgi: string;
  cizgiSolgun: string;
  cizgiGuclu: string;

  // Yazı
  metin: string;
  metinIkincil: string;
  metinSolgun: string;
  metinTers: string;

  // Vurgu
  birincil: string;
  birincilKoyu: string;
  birincilYumusak: string;

  // Durum
  basari: string;
  basariYumusak: string;
  uyari: string;
  uyariYumusak: string;
  tehlike: string;
  tehlikeYumusak: string;
  bilgi: string;
  bilgiYumusak: string;

  // Derece — 3 en ağır, 1 en hafif (ekibin sistemi; parantezli = kabul edilebilir)
  derece3: string;
  derece3Yumusak: string;
  derece2: string;
  derece2Yumusak: string;
  derece1: string;
  derece1Yumusak: string;
  /** Demerit 0 (26.10.2026): nötr — kayda geçer, puana girmez. */
  derece0: string;
  derece0Yumusak: string;

  // Ters yüzey — iki temada da koyu lacivert. Yalnız içerik ÜSTÜNDE yüzen
  // şeyler için: kayıt bildirimi (snackbar) ve barkod kamerasının çerçevesi.
  // 25.10.2026'ya kadar uygulama çubuğu da buydu; çubuk artık sayfa
  // zemininde, bu tokenlar yalnız yüzen katmanlarda kaldı.
  ters: string;
  tersYuzey: string;
  tersCizgi: string;
  tersMetin: string;
  tersMetinSolgun: string;
  tersVurgu: string;
  tersVurguMetin: string;

  // Diğer
  perde: string;
  seffaf: string;
  /** Kart gölgesi — `boxShadow` içinde kullanılır, tek başına renk değildir.
   *  Vekil Pro `shadow.card`: 0 4 12, %8 lacivert. */
  golge: string;
}

/**
 * TERS YÜZEY — koyu lacivert, iki temada da aynı. Vurgu açık çelik mavisi:
 * koyu zemin üstünde yazı olarak (bildirimdeki "Geri al") ve barkod
 * çerçevesinin köşelerinde kullanılıyor; o yüzden AÇIK olmak zorunda.
 * Kontrast (kontrast.py, 25.10.2026): metin 14,6:1, vurgu 7,6:1.
 */
const TERS = {
  ters: '#14233F',
  tersYuzey: '#1E3158',
  tersCizgi: '#2F4772',
  tersMetin: '#F4F7FB',
  tersMetinSolgun: '#A9B9CF',
  tersVurgu: '#7FB3FF',
  tersVurguMetin: '#071A33',
} as const;

/**
 * AÇIK TEMA — Vekil Pro "Klasik": soğuk mermer zemin, beyaz kartlar (yumuşak
 * gölge + ince kenar), koyu kraliyet lacivertî vurgu. Derece renkleri
 * (kırmızı, turuncu, sarı) vurguyla çarpışmaz. Kontrastlar WCAG formülüyle
 * `scratchpad/kontrast.py` ile ölçüldü (25.10.2026): küçük yazı her yüzeyde
 * ≥ 4,5:1.
 */
const acik: Renkler = {
  bg: '#EEF2F8',
  bgYukseltilmis: '#FFFFFF',
  yuzey: '#FFFFFF',
  yuzeyAlt: '#F2F5FA',
  yuzeyVurgu: '#E4EBF5',

  cizgi: '#CFD9EA',
  cizgiSolgun: '#E4EAF4',
  cizgiGuclu: '#8A98A9',

  metin: '#0F1B33',
  metinIkincil: '#44506B',
  metinSolgun: '#56657F',
  metinTers: '#FFFFFF',

  birincil: '#173C7E',
  birincilKoyu: '#10295A',
  birincilYumusak: '#DCE6F6',

  basari: '#0F7148',
  basariYumusak: '#DAF1E5',
  uyari: '#A9540A',
  uyariYumusak: '#FCEDD9',
  tehlike: '#AE2018',
  tehlikeYumusak: '#FCE2DF',
  bilgi: '#173C7E',
  bilgiYumusak: '#E3EBF8',

  derece3: '#AE2018',
  derece3Yumusak: '#FCE2DF',
  derece2: '#A75508',
  derece2Yumusak: '#FCEDD9',
  derece1: '#856808',
  derece1Yumusak: '#F8F1D4',
  derece0: '#4E5D75',
  derece0Yumusak: '#E9EEF5',

  ...TERS,

  perde: 'rgba(8, 14, 24, 0.6)',
  seffaf: 'transparent',
  golge: 'rgba(26, 44, 81, 0.08)',
};

/**
 * KOYU TEMA — naif ters çevirme DEĞİL. Zemin lacivert-füme; vurgu ve durum
 * renkleri koyu zeminde okunacak şekilde ayrı ayrı açıldı.
 */
const koyu: Renkler = {
  bg: '#0B1118',
  bgYukseltilmis: '#111A24',
  yuzey: '#141E2A',
  yuzeyAlt: '#1B2735',
  yuzeyVurgu: '#243243',

  cizgi: '#2A3847',
  cizgiSolgun: '#1F2B38',
  cizgiGuclu: '#4A5C70',

  metin: '#E8EEF5',
  metinIkincil: '#A6B4C3',
  metinSolgun: '#8E9DAE',
  metinTers: '#0B1118',

  birincil: '#7FB3FF',
  birincilKoyu: '#4F8BE6',
  birincilYumusak: '#14294A',

  basari: '#45D796',
  basariYumusak: '#0D2A1E',
  uyari: '#F2A43F',
  uyariYumusak: '#31220B',
  tehlike: '#FF7A6A',
  tehlikeYumusak: '#33140E',
  bilgi: '#7FB3FF',
  bilgiYumusak: '#14294A',

  derece3: '#FF7A6A',
  derece3Yumusak: '#33140E',
  derece2: '#F2A43F',
  derece2Yumusak: '#31220B',
  derece1: '#DFC248',
  derece1Yumusak: '#2C2608',
  derece0: '#A6B4C3',
  derece0Yumusak: '#1B2735',

  ...TERS,

  perde: 'rgba(0, 0, 0, 0.66)',
  seffaf: 'transparent',
  golge: 'rgba(0, 0, 0, 0.4)',
};

export const PALETLER: Record<TemaAdi, Renkler> = { acik, koyu };

/** Dereceden renk çifti — tabloda, rozette, 3B modelde aynı kaynak. */
export function dereceRenkleri(renkler: Renkler, derece: string) {
  switch (derece) {
    case '3': return { on: renkler.derece3, arka: renkler.derece3Yumusak };
    case '2': return { on: renkler.derece2, arka: renkler.derece2Yumusak };
    case '0': return { on: renkler.derece0, arka: renkler.derece0Yumusak };
    default: return { on: renkler.derece1, arka: renkler.derece1Yumusak };
  }
}
