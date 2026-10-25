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

/**
 * Köşe yuvarlaklığı — Vekil Pro'nun ölçüleri (8/12/16/20). 24.10.2026'da
 * önce 4/6/8/12'ye indirilmişti; ürün sahibi o hâli de beğenmedi ("arayüz
 * beğenmedim"). Vekil Pro aynı ürün sahibinin onayından geçmiş tek tasarım
 * dili; ölçüler oradan alındı, yeniden icat edilmedi.
 */
export const kose = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Yazı tipi: TEK aile, Manrope (25.10.2026). Sıra: IBM Plex → Inter +
 * JetBrains Mono → Manrope. Ürün sahibi "yazı tipi falan kötü duruyor" dedi;
 * ekran görüntülerinde göze batan şey eşit genişlikli yazıydı — büyük
 * sayılarda çizgili sıfır ("0 derece 3"), şasi kutusunda terminal görünümü.
 * Manrope, Vekil Pro'nun gövde yazısı: geniş x-yüksekliği, Türkçe karakter
 * takımı tam, rakamları temiz. Dosyalar assets/fonts altında (bkz. _layout.tsx).
 *
 * Şasi numarası artık eşit genişlikli DEĞİL; `tipografi.kimlik` harf aralığını
 * açar. VIN standardında I, O, Q zaten yoktur; 0/O karışması bu yüzden mono
 * gerektirmez.
 */
export const yazi = {
  normal: 'Manrope_400Regular',
  orta: 'Manrope_500Medium',
  yariKalin: 'Manrope_600SemiBold',
  kalin: 'Manrope_700Bold',
  cokKalin: 'Manrope_800ExtraBold',
} as const;

/**
 * Tipografi STİL NESNELERİ döner — sayı değil.
 * Kullanım: `{ ...tipografi.h3, color: renkler.metin }`
 * `fontSize: tipografi.h3` bir tip hatasıdır.
 *
 * Ölçek Vekil Pro `tokens.ts` ile aynı (display 30 … small 11); buradaki ek
 * stiller (kimlik, sayı) bu uygulamaya özgü.
 */
export const tipografi = {
  display: { fontFamily: yazi.cokKalin, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h1: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h2: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: yazi.yariKalin, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22 },
  bodyOrta: { fontFamily: yazi.yariKalin, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: yazi.orta, fontSize: 13, lineHeight: 18 },
  captionOrta: { fontFamily: yazi.yariKalin, fontSize: 13, lineHeight: 18 },
  /**
   * Küçük etiket (alan adı, sütun başlığı, künye anahtarı). NORMAL YAZIMLA
   * kullanılır: "Body no", "Bu hafta". 25.10.2026'ya kadar bütün etiketler
   * büyük harf + geniş aralıktı; ekranı "panel/terminal" gibi gösteriyordu.
   */
  etiket: { fontFamily: yazi.yariKalin, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  /** Şasi numarası, body no — satır içinde. */
  kimlik: { fontFamily: yazi.yariKalin, fontSize: 15, lineHeight: 21, letterSpacing: 0.6 },
  /** Şasi girişi ve şasi başlığı. */
  kimlikBuyuk: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 28, letterSpacing: 1.5 },
  /** Sayı sütunları — haneler hizalı dursun. */
  sayi: { fontFamily: yazi.yariKalin, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  sayiBuyuk: { fontFamily: yazi.kalin, fontSize: 26, lineHeight: 32, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** En küçük dokunma hedefi. Eldivenli parmak için bundan aşağısı olmaz. */
export const DOKUNMA = 48;

/** İkona verilecek dokunma payı (küçük ikonlar için). */
export const HITSLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/**
 * Tablet düzeni eşiği (dp). İki koşul birlikte aranır:
 *  - kısa kenar >= 600: Android'in "sw600dp" tablet eşiği. Telefon yatay
 *    çevrilince genişliği 800'ü geçer ama yüksekliği ~400 kalır; iki bölmeli
 *    düzen orada sıkışır. Kısa kenar şartı telefonu hep tek bölmede tutar.
 *  - genişlik >= 720: dikey tablet (768–834) iki bölmeli açılsın.
 */
export const TABLET_KISA_KENAR = 600;
export const TABLET_GENISLIK = 720;
