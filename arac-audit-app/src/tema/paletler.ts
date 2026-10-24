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
// düğme" aynı sinyali verir. 24.10.2026'ya kadar teal'di; ürün sahibi
// "görsel olarak çok kötü, dandik, profesyonel yap" dedi. Koyu lacivert
// çubuk + çelik mavisi vurgu, daha keskin köşeler, gölgesiz düz kartlar.

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

  // Uygulama çubuğu — İKİ TEMADA DA KOYU. Açık temada da koyu durması
  // bilinçli: sahada ekranın hangi uygulamada olduğunu bir bakışta ayırır ve
  // içerikle araç çubuğunu ayırır. Kontrastlar WCAG formülüyle hesaplandı
  // (27.09.2026): metin 15.2:1, soluk metin 7.2:1, vurgu üstü metin 7.6:1.
  cubuk: string;
  cubukYuzey: string;
  cubukCizgi: string;
  cubukMetin: string;
  cubukMetinSolgun: string;
  cubukVurgu: string;
  cubukVurguMetin: string;

  // Diğer
  perde: string;
  seffaf: string;
  /** Kart gölgesi — `boxShadow` içinde kullanılır, tek başına renk değildir. */
  golge: string;
}

/**
 * ÇUBUK — koyu lacivert, iki temada da aynı. Vurgu açık çelik mavisi: koyu
 * zemin üstünde yazı olarak da (bildirimdeki "Geri al"), birincil düğmenin
 * zemini olarak da (üstünde koyu yazı) kullanılıyor; o yüzden AÇIK olmak
 * zorunda, koyu bir mavi bildirimde okunmazdı.
 */
const CUBUK = {
  cubuk: '#0B1F3A',
  cubukYuzey: '#16305A',
  cubukCizgi: '#27477A',
  cubukMetin: '#F4F7FB',
  cubukMetinSolgun: '#A9B9CF',
  cubukVurgu: '#7FB3FF',
  cubukVurguMetin: '#071A33',
} as const;

/**
 * AÇIK TEMA — nötrler soğuk gri; yüzeyler düz beyaz, kart gölgesi yok (kenar
 * çizgisiyle ayrılır). Vurgu koyu çelik mavisi: derece renklerinin (kırmızı,
 * turuncu, sarı) hiçbirine yakın değil. Kontrastlar WCAG formülüyle
 * `scratchpad/kontrast.py` ile ölçüldü (24.10.2026): küçük yazı her yüzeyde
 * ≥ 4.5:1.
 */
const acik: Renkler = {
  bg: '#EEF1F5',
  bgYukseltilmis: '#FFFFFF',
  yuzey: '#FFFFFF',
  yuzeyAlt: '#E4E9F0',
  yuzeyVurgu: '#D9E0E9',

  cizgi: '#C7D0DB',
  cizgiSolgun: '#E1E6EC',
  cizgiGuclu: '#8A98A9',

  metin: '#101826',
  metinIkincil: '#414F66',
  metinSolgun: '#52617A',
  metinTers: '#FFFFFF',

  birincil: '#1D4F9E',
  birincilKoyu: '#163C79',
  birincilYumusak: '#E3EBF8',

  basari: '#0F7148',
  basariYumusak: '#DAF1E5',
  uyari: '#A9540A',
  uyariYumusak: '#FCEDD9',
  tehlike: '#AE2018',
  tehlikeYumusak: '#FCE2DF',
  bilgi: '#1D4F9E',
  bilgiYumusak: '#E3EBF8',

  derece3: '#AE2018',
  derece3Yumusak: '#FCE2DF',
  derece2: '#A75508',
  derece2Yumusak: '#FCEDD9',
  derece1: '#856808',
  derece1Yumusak: '#F8F1D4',

  ...CUBUK,

  perde: 'rgba(8, 14, 24, 0.6)',
  seffaf: 'transparent',
  golge: 'rgba(16, 24, 40, 0.06)',
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

  ...CUBUK,

  perde: 'rgba(0, 0, 0, 0.66)',
  seffaf: 'transparent',
  golge: 'rgba(0, 0, 0, 0.45)',
};

export const PALETLER: Record<TemaAdi, Renkler> = { acik, koyu };

/** Dereceden renk çifti — tabloda, rozette, 3B modelde aynı kaynak. */
export function dereceRenkleri(renkler: Renkler, derece: string) {
  switch (derece) {
    case '3': return { on: renkler.derece3, arka: renkler.derece3Yumusak };
    case '2': return { on: renkler.derece2, arka: renkler.derece2Yumusak };
    default: return { on: renkler.derece1, arka: renkler.derece1Yumusak };
  }
}
