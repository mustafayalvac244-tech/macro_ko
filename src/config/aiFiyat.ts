/**
 * AI işlemlerinin YAKLAŞIK ücreti (TL) — kullanıcıya ÖNCEDEN göstermek için.
 *
 * NEDEN ÖNCEDEN. Kontörle çalışan bir üründe kullanıcının parasının nereye
 * gittiğini işlem BİTTİKTEN sonra öğrenmesi, güveni bitiren şeydir. "Bu mütalaa
 * yaklaşık 13 TL" demek, kullanıcıyı hazırlıksız yakalamamaktır.
 *
 * SAYILAR ÖLÇÜLDÜ, TAHMİN EDİLMEDİ. Gerçek isteklerin token sayıları
 * kaydedildi (ai_usage): girdi ~5.000-8.000, çıktı ~1.300-3.000 token. Claude
 * Sonnet 5 fiyatı 1M girdi için 2 USD, 1M çıktı için 10 USD; 1 USD = 42 TL.
 * Buradan çıkan maliyet, iş kuralı gereği ÜÇ ile çarpılıyor (bir birim
 * sağlayıcıya, iki birim kâr).
 *
 * YAKLAŞIKTIR ve öyle sunulmalı: gerçek ücret, sorunun ve belgenin uzunluğuna
 * göre değişir. Kesin tutar her yanıtın altında yazıyor. Kullanıcıya "tam 5,70
 * TL" demek, uzun bir olay anlatımında yanlış çıkacak bir sözdür.
 */
export interface AiFiyat {
  /** Bize maliyeti (TL) — iç bilgi, ekranda gösterilmez. */
  maliyet: number;
  /** Kullanıcıdan alınan (TL) = maliyet × 3. */
  ucret: number;
}

export const AI_FIYAT: Record<'sohbet' | 'dilekce' | 'belge' | 'mutalaa', AiFiyat> = {
  sohbet: { maliyet: 1.0, ucret: 3.0 },
  dilekce: { maliyet: 1.9, ucret: 5.7 },
  belge: { maliyet: 1.3, ucret: 3.9 },
  mutalaa: { maliyet: 4.5, ucret: 13.5 },
};

/** Kontör paketinin kaç işleme yeteceği — pakette ne aldığını göstermek için. */
export function kacIslem(bakiyeTL: number, tur: keyof typeof AI_FIYAT): number {
  const u = AI_FIYAT[tur].ucret;
  return u > 0 ? Math.floor(bakiyeTL / u) : 0;
}
