/**
 * EK BELGE KURALLARI — istemci tarafı (saf; tests/belgeEki.test.ts ve
 * tests/belgeEkiOkuma.test.ts sınıyor).
 *
 * Sayılar sunucudakilerle (supabase/functions/_shared/belgeEki.ts) AYNI
 * olmalı; test ikisini karşılaştırır. Neden istemcide de var: görüntüsüyle
 * okunmayacak bir PDF'in megabaytlarını boşuna yüklememek ve avukata ekin
 * NASIL okunacağını göndermeden önce söylemek.
 */

/** Görüntüsüyle okunan toplam sayfa tavanı (sunucu: PDF_SAYFA_TAVANI). ÜRÜN KARARI. */
export const PDF_SAYFA_TAVANI = 20;
/** Bir istekte en çok kaç ek (sunucu: EK_EN_COK). */
export const EK_EN_COK = 3;
/** Ek başına dosya boyutu tavanı (sunucu: EK_PDF_TAVANI_BAYT, doc-extract ~8 MB). */
export const EK_DOSYA_TAVANI_BAYT = 8 * 1024 * 1024;
/** Eklerin toplam metin tavanı — karakter (sunucu: EK_METIN_TAVANI). ÜRÜN KARARI. */
export const EK_METIN_TAVANI = 40_000;

export type EkOkuma = 'gorsel' | 'metin' | 'yok';

interface EkOz {
  ad: string;
  metin: string;
  pdf?: string;
  sayfa?: number;
  taranmis?: number;
}

/**
 * Her ekten KAÇ KARAKTER okunacağı — sunucudaki metin bütçesiyle aynı sırada
 * (ekleriAyikla). İlk ekler bütçeyi doldurur; tavanı aşan ekin yalnız başı
 * okunur, bütçe bitince sonrakilerin hiç metni okunmaz.
 *
 * NEDEN (09.10.2026, 08.10 denetimi): sunucu 40.000 karakterden sonrasını
 * kesiyordu ve ekran ekin altında "metni okunacak" yazıyordu — avukat
 * belgenin tamamının okunacağını sanıyordu.
 */
export function ekMetinPayi(ekler: EkOz[]): number[] {
  let toplam = 0;
  return ekler.map((e) => {
    const pay = Math.min(e.metin.length, Math.max(0, EK_METIN_TAVANI - toplam));
    toplam += pay;
    return pay;
  });
}

/**
 * Her ekin nasıl okunacağı. Sunucudaki ekleriAyikla ile aynı sırada aynı
 * sayfa ve metin bütçesini uygular: ilk ekler bütçeyi doldurur, sonrakiler
 * metne düşer; metin bütçesi de bitmişse hiç okunmaz ('yok').
 */
export function ekOkumaPlani(ekler: EkOz[]): EkOkuma[] {
  const pay = ekMetinPayi(ekler);
  let sayfaToplam = 0;
  return ekler.map((e, i) => {
    const sayfa = e.sayfa ?? 0;
    if (e.pdf && sayfa > 0 && sayfaToplam + sayfa <= PDF_SAYFA_TAVANI) {
      sayfaToplam += sayfa;
      return 'gorsel';
    }
    return e.metin.slice(0, pay[i]).trim() ? 'metin' : 'yok';
  });
}

/** Sunucuya gidecek gövde: görüntüsüyle okunmayacak PDF'in baytları gönderilmez. */
export function ekGovdesi(ekler: EkOz[]): EkOz[] {
  const plan = ekOkumaPlani(ekler);
  const govde: EkOz[] = [];
  ekler.forEach((e, i) => {
    if (plan[i] === 'yok') return;
    govde.push({
      ad: e.ad,
      metin: e.metin,
      sayfa: e.sayfa,
      taranmis: e.taranmis,
      ...(plan[i] === 'gorsel' ? { pdf: e.pdf } : {}),
    });
  });
  return govde;
}

/** base64'ün temsil ettiği yaklaşık bayt sayısı (sunucudaki base64Bayt ile aynı). */
function base64Bayt(b64: string): number {
  const dolgu = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - dolgu;
}

/**
 * Görüntüsüyle gidecek PDF'lerin toplamı sunucu tavanını aşıyor mu.
 *
 * NEDEN (09.10.2026, 08.10 denetimi): ek başına 8 MB denetleniyordu, toplam
 * denetlenmiyordu. İki taranmış PDF (ör. 5 + 4 MB) ayrı ayrı kabul ediliyor,
 * ikisinin altında "sayfa görüntüleriyle okunacak" yazıyor, avukat olayı
 * yazıp gönderince sunucu isteği 'ek_buyuk' ile reddediyordu. Bir ek
 * kaldırılınca plan değişebildiği için (sonraki PDF görüntü bütçesine girer)
 * ekleme anında değil, her çizimde hesaplanır.
 */
export function ekBoyutuAsiyor(ekler: EkOz[]): boolean {
  const plan = ekOkumaPlani(ekler);
  let bayt = 0;
  ekler.forEach((e, i) => {
    if (plan[i] === 'gorsel' && e.pdf) bayt += base64Bayt(e.pdf);
  });
  return bayt > EK_DOSYA_TAVANI_BAYT;
}

/**
 * Metni SUNUCUDA (doc-extract) çıkarılan türler. Gerisi (txt, csv, uzantısız
 * düz metin) cihazda okunur: kodlaması çözülür, ikiliyse reddedilir — bkz.
 * src/utils/metinKodlama.ts > metinDosyasiCoz.
 */
export function sunucudaOkunur(ad: string): boolean {
  return /\.(pdf|udf|docx|doc|rtf)$/i.test(ad);
}

/** Ek okuma hataları — ekran `ek.hata.<kod>` metnini gösterir (tr + en). */
export const EK_HATALARI = ['bos', 'taranmisUzun', 'eskiDoc', 'buyuk', 'okunamadi', 'desteklenmiyor', 'oturum'] as const;
export type EkHatasi = (typeof EK_HATALARI)[number];

/**
 * doc-extract hata kodu → ekranın göstereceği sebep.
 *
 * BULUNAN KUSUR (08.10 denetimi): yalnız üç kod ayrılıyordu, gerisi "Dosya
 * okunamadı" oluyordu. Boş dosya ('empty') "okunamadı" diyor, süresi dolmuş
 * oturum ('unauthorized') avukata dosyasının bozuk olduğunu düşündürüyordu.
 * 'unsupported' (09.10): uç ikili dosyayı artık metin diye okumuyor.
 */
export function ekHatasi(kod: string): EkHatasi {
  if (kod === 'doc_legacy') return 'eskiDoc';
  if (kod === 'too_large') return 'buyuk';
  if (kod === 'empty') return 'bos';
  if (kod === 'unsupported') return 'desteklenmiyor';
  if (kod === 'unauthorized') return 'oturum';
  return 'okunamadi';
}

/** Yanıtın `ekUyari` alanı (sunucu: EkUyari, _shared/belgeEki.ts > ekUyarisi). */
export interface EkUyari {
  pdfdenMetne?: string[];
  okunamayan?: string[];
  taranmis?: boolean;
  /** Metninin yalnız başı okunan ekler. */
  kirpilan?: Array<{ ad: string; okunan: number; toplam: number }>;
}
