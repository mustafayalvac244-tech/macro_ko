// ÖLÇÜ TOKEN'LARI — boşluk, köşe, tipografi.
//
// Renk burada YOK: renk temaya bağlıdır ve `paletler.ts`ten gelir. Ölçüler
// temadan bağımsızdır, o yüzden ayrı dosyada durur ve doğrudan içe aktarılır.
//
// Kural: skala dışı değer kullanma. `padding: 14` yerine 12 ya da 16.
// İstisna: 1-6 px'lik optik hizalama düzeltmeleri (`marginTop: 2`).

import { TextStyle } from 'react-native';

/** 4 tabanlı boşluk skalası. */
export const bosluk = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Köşe yuvarlaklığı. Bu bir alet; köşeler yumuşak değil, ölçülü. */
export const kose = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * Yazı tipi aileleri.
 * IBM Plex, endüstriyel ve mühendislik bağlamı için tasarlandı; Türkçe
 * karakterleri tam, ve mono eşi şasi numarası/hata kodu için gerçekten
 * işlevsel (süsleme değil): eşit genişlikli haneler yanlış okumayı azaltır.
 */
export const yazi = {
  normal: 'IBMPlexSans_400Regular',
  orta: 'IBMPlexSans_500Medium',
  yariKalin: 'IBMPlexSans_600SemiBold',
  kalin: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoKalin: 'IBMPlexMono_600SemiBold',
} as const;

/**
 * Tipografi STİL NESNELERİ döner — sayı değil.
 * Kullanım: `{ ...tipografi.h3, color: renkler.textPrimary }`
 * `fontSize: tipografi.h3` bir tip hatasıdır.
 */
export const tipografi = {
  display: { fontFamily: yazi.kalin, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  h1: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h2: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: yazi.yariKalin, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22 },
  bodyOrta: { fontFamily: yazi.orta, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18 },
  captionOrta: { fontFamily: yazi.orta, fontSize: 13, lineHeight: 18 },
  /** Küçük büyük harfli etiket. Metni i18n'de ZATEN büyük yazın:
   *  textTransform "i" harfini "I" yapar, Türkçe'de doğrusu "İ"dir. */
  etiket: { fontFamily: yazi.yariKalin, fontSize: 11, lineHeight: 15, letterSpacing: 0.7 },
  /** Şasi numarası, hata kodu, plaka. */
  mono: { fontFamily: yazi.mono, fontSize: 15, lineHeight: 21, letterSpacing: 0.4 },
  monoBuyuk: { fontFamily: yazi.monoKalin, fontSize: 21, lineHeight: 28, letterSpacing: 1.6 },
  /** Sayı sütunları — haneler hizalı dursun. */
  sayi: { fontFamily: yazi.mono, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  sayiBuyuk: { fontFamily: yazi.monoKalin, fontSize: 26, lineHeight: 32, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** En küçük dokunma hedefi. Eldivenli parmak için bundan aşağısı olmaz. */
export const DOKUNMA = 48;

/** İkona verilecek dokunma payı (küçük ikonlar için). */
export const HITSLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
