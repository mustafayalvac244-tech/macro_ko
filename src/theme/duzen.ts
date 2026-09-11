import { Platform } from 'react-native';

/**
 * GENİŞ EKRAN DÜZENİ (yalnız web).
 *
 * BULUNAN KUSUR: uygulama telefon düzeniyle yazıldı ve web'de o düzen ekranın
 * TAMAMINA esnetiliyordu. 1900 px'lik bir masaüstünde tek bir kart 1870 px
 * genişliyor, "Gelir ₺0" yazısı boş bir tarlanın ortasında kalıyor, göz satır
 * başını bulamıyordu. Bu bir renk/görsel sorunu değil, ÖLÇÜ sorunudur:
 * okunabilir bir metin sütunu ~60-75 karakterdir, kart ızgarası da benzer bir
 * üst sınıra ihtiyaç duyar.
 *
 * ÇÖZÜM: içerik sabit bir üst genişlikte ORTALANIR. Üst çubuk (marka, zil,
 * avatar) tam genişlikte kalır — masaüstü uygulamalarında başlık çubuğu
 * kenardan kenara uzanır, içerik ortalanır.
 *
 * NATİFTE HİÇBİR ŞEY DEĞİŞMEZ: telefonda ekran genişliği zaten bu sınırın
 * altında ve Platform.OS kontrolü natifte devre dışı bırakır.
 */

/**
 * Sütun genişlikleri. Üçe ayrılmasının sebebi: bir dava listesi ile bir giriş
 * formu aynı genişliği İSTEMEZ. 1180 px'lik bir giriş formunda e-posta kutusu
 * ekranın bir ucundan diğerine uzanır ve amatör durur.
 */
export const SUTUN_GENISLIKLERI = {
  /** Liste, ızgara, pano — birden çok sütun taşıyabilen ekranlar. */
  genis: 1180,
  /** Okuma ve uzun metin (kanun maddesi, sözleşme) — satır uzunluğu sınırlı. */
  dar: 860,
  /** Tek sütunlu form (giriş, kayıt, şifre) — tek bir kart gibi durmalı. */
  form: 480,
} as const;

export type SutunTuru = keyof typeof SUTUN_GENISLIKLERI;

/** Geriye dönük ad — dış kodda kullanılıyorsa kırılmasın. */
export const ICERIK_MAX_GENISLIK = SUTUN_GENISLIKLERI.genis;

/** Bu genişliğin üstünde "masaüstü" sayılır (tablet yatay ve üstü). */
export const GENIS_ESIK = 1024;

export function genisEkranMi(pencereGenisligi: number): boolean {
  return Platform.OS === 'web' && pencereGenisligi >= GENIS_ESIK;
}

/**
 * KALICI YAN MENÜ.
 *
 * Uygulamanın menüsü hamburger düğmesinin arkasında duruyor — telefon deseni.
 * Nielsen Norman Group'un dikey gezinme incelemesi bunun masaüstünde bir kusur
 * olduğunu söylüyor: kullanıcı zamanın ~%80'inde ekranın SOL yarısına bakıyor,
 * dikey liste yatay listeden daha hızlı taranıyor (tek bakışta daha çok öge)
 * ve öneri açıkça "gezinmeyi görünür tut, hamburger menünün arkasına saklama".
 * Kaynak: nngroup.com/articles/vertical-nav/
 * Material 3 de aynı yönde: "expanded" (≥840dp) genişlikte kalıcı (standard)
 * navigation drawer öneriliyor.
 *
 * EŞİK NEDEN 1280: menü 272 px. 1180 px'lik içerik sütunu + menü = 1452 px.
 * 1280'in altında menüyü kalıcı yapmak içeriği ezerdi; orada hamburger daha
 * doğru. Natifte her zaman false — telefonda kalıcı menü yeri yok.
 */
export const YAN_MENU_GENISLIGI = 272;
export const KALICI_MENU_ESIGI = 1280;

export function kaliciMenuMu(pencereGenisligi: number): boolean {
  return Platform.OS === 'web' && pencereGenisligi >= KALICI_MENU_ESIGI;
}

export interface OrtalamaStili {
  width: '100%';
  maxWidth: number;
  alignSelf: 'center';
}

/**
 * Ortalanmış içerik sütununun stili. Geniş ekran değilse `null` döner —
 * çağıran taraf `[styles.x, ortalaStili(w)]` diye dizi verdiğinde null
 * öge React Native tarafından yok sayılır, yani dar ekranda ek stil yok.
 */
export function ortalaStili(pencereGenisligi: number, tur: SutunTuru = 'genis'): OrtalamaStili | null {
  if (!genisEkranMi(pencereGenisligi)) return null;
  return {
    width: '100%',
    maxWidth: SUTUN_GENISLIKLERI[tur],
    alignSelf: 'center',
  };
}

/**
 * Geniş ekranda bir satıra kaç sütun sığdırılacağı.
 * Kart genişliği `enAzKart` px'in altına düşerse sütun sayısı azaltılır.
 */
export function sutunSayisi(pencereGenisligi: number, enAzKart = 340, enFazla = 2): number {
  if (!genisEkranMi(pencereGenisligi)) return 1;
  const kullanilabilir = Math.min(pencereGenisligi, SUTUN_GENISLIKLERI.genis);
  const sigan = Math.floor(kullanilabilir / enAzKart);
  return Math.max(1, Math.min(enFazla, sigan));
}
