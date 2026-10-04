/**
 * EK BELGE KURALLARI — istemci tarafı (saf; tests/belgeEki.test.ts sınıyor).
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

export type EkOkuma = 'gorsel' | 'metin' | 'yok';

interface EkOz {
  ad: string;
  metin: string;
  pdf?: string;
  sayfa?: number;
  taranmis?: number;
}

/**
 * Her ekin nasıl okunacağı. Sunucudaki ekleriAyikla ile aynı sırada aynı
 * sayfa bütçesini uygular: ilk ekler bütçeyi doldurur, sonrakiler metne düşer.
 */
export function ekOkumaPlani(ekler: EkOz[]): EkOkuma[] {
  let sayfaToplam = 0;
  return ekler.map((e) => {
    const sayfa = e.sayfa ?? 0;
    if (e.pdf && sayfa > 0 && sayfaToplam + sayfa <= PDF_SAYFA_TAVANI) {
      sayfaToplam += sayfa;
      return 'gorsel';
    }
    return e.metin.trim() ? 'metin' : 'yok';
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
