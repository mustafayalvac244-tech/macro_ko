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
// Vurgu rengi neden teal: şiddet sınıfları kırmızı/turuncu/sarıyı ZATEN
// tutuyor. Vurgu bunlarla çarpışmamalı, yoksa "kritik hata" ile "birincil
// düğme" aynı sinyali verir. Teal ölçüm aleti çağrışımı taşır ve üç şiddet
// renginin hiçbirine yakın değildir.

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

  // Hata şiddeti — A kritik, B majör, C minör
  siddetA: string;
  siddetAYumusak: string;
  siddetB: string;
  siddetBYumusak: string;
  siddetC: string;
  siddetCYumusak: string;

  // Diğer
  perde: string;
  seffaf: string;
}

/**
 * AÇIK TEMA — nötrler saf gri değil, hafif mavi-çelik yönünde. Saf gri
 * "seçilmemiş" görünür; gövde sacının rengine kayan gri seçilmiş görünür.
 */
const acik: Renkler = {
  bg: '#F1F4F7',
  bgYukseltilmis: '#FFFFFF',
  yuzey: '#FFFFFF',
  yuzeyAlt: '#E7ECF1',
  yuzeyVurgu: '#DDE4EB',

  cizgi: '#C9D2DB',
  cizgiSolgun: '#E2E8EE',
  cizgiGuclu: '#94A3B1',

  metin: '#0F161D',
  metinIkincil: '#475765',
  metinSolgun: '#74838F',
  metinTers: '#FFFFFF',

  birincil: '#0C7480',
  birincilKoyu: '#08545D',
  birincilYumusak: '#DCEFF1',

  basari: '#0F7148',
  basariYumusak: '#DAF1E5',
  uyari: '#A9540A',
  uyariYumusak: '#FCEDD9',
  tehlike: '#AE2018',
  tehlikeYumusak: '#FCE2DF',
  bilgi: '#1B5A9F',
  bilgiYumusak: '#E0EBF8',

  siddetA: '#AE2018',
  siddetAYumusak: '#FCE2DF',
  siddetB: '#B85E09',
  siddetBYumusak: '#FCEDD9',
  siddetC: '#8C6E08',
  siddetCYumusak: '#F8F1D4',

  perde: 'rgba(10, 16, 22, 0.55)',
  seffaf: 'transparent',
};

/**
 * KOYU TEMA — naif ters çevirme DEĞİL. Zemin nötr siyah değil, aynı
 * mavi-çelik yönünde koyu; vurgu ve durum renkleri koyu zeminde okunacak
 * şekilde ayrı ayrı açıldı (açık temadakinin aynısı koyu zeminde söner).
 */
const koyu: Renkler = {
  bg: '#0B1016',
  bgYukseltilmis: '#121A22',
  yuzey: '#151E27',
  yuzeyAlt: '#1C2732',
  yuzeyVurgu: '#243140',

  cizgi: '#2B3845',
  cizgiSolgun: '#1F2A35',
  cizgiGuclu: '#46596B',

  metin: '#E7EEF4',
  metinIkincil: '#A4B3C0',
  metinSolgun: '#788896',
  metinTers: '#0B1016',

  birincil: '#2BC0CC',
  birincilKoyu: '#1A8F99',
  birincilYumusak: '#0E3339',

  basari: '#45D796',
  basariYumusak: '#0D2A1E',
  uyari: '#F2A43F',
  uyariYumusak: '#31220B',
  tehlike: '#FF7A6A',
  tehlikeYumusak: '#33140E',
  bilgi: '#6CA6EE',
  bilgiYumusak: '#0F223B',

  siddetA: '#FF7A6A',
  siddetAYumusak: '#33140E',
  siddetB: '#F2A43F',
  siddetBYumusak: '#31220B',
  siddetC: '#DFC248',
  siddetCYumusak: '#2C2608',

  perde: 'rgba(0, 0, 0, 0.66)',
  seffaf: 'transparent',
};

export const PALETLER: Record<TemaAdi, Renkler> = { acik, koyu };

/** Şiddet kodundan renk çifti — tabloda, rozette, 3B modelde aynı kaynak. */
export function siddetRenkleri(renkler: Renkler, siddet: string) {
  switch (siddet) {
    case 'A': return { on: renkler.siddetA, arka: renkler.siddetAYumusak };
    case 'B': return { on: renkler.siddetB, arka: renkler.siddetBYumusak };
    default: return { on: renkler.siddetC, arka: renkler.siddetCYumusak };
  }
}
