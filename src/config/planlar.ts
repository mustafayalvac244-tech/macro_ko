/**
 * PLAN MODELİ — tek kaynak.
 *
 * ÜRÜN KARARI. İçtihat ücretsizdir; yapay zekâ ücretlidir; 399 ₺'lik Pro
 * planının da gerçek bir karşılığı vardır. Öncesinde `is_premium` uygulamada
 * hiçbir şeyi açmıyordu (arandı: yalnız avatar rozeti ve admin paneli) — yani
 * abonelik satılıp karşılığında bir şey verilmiyordu.
 *
 * BURADAKİ SAYILAR YALNIZCA GÖSTERİM İÇİNDİR. Gerçek kısıt veritabanındaki
 * `plan_limiti_kontrol` tetikleyicisidir (migration 0087). İkisi ayrışırsa
 * DOĞRU OLAN VERİTABANIDIR — istemcideki bir sayı kullanıcıyı yanlış
 * bilgilendirir ama kapıyı açmaz. Bu ayrım bilinçli: bu oturumda istemci
 * tarafı kilidin sahte olduğu iki kez kanıtlandı.
 *
 * ÜCRETSİZ KATMANDA BİLİNÇLİ OLARAK SINIRSIZ OLANLAR — ve nedenleri:
 *  • İçtihat araması: kullanıcının açık kararı. Ayrıca bize API ücreti de
 *    getirmiyor; canlı UYAP/Bedesten'e gidiyor.
 *  • Mevzuat, hesaplayıcılar, dilekçe şablonları: tamamı uygulamanın içinde,
 *    ek maliyeti yok.
 *  • Duruşma, görev, ajanda, hatırlatmalar: uygulamanın ÇEKİRDEK faydası.
 *    Bir avukatın duruşma takvimini sınırlamak ürünü kullanılamaz kılar ve
 *    ücretsiz katmanı bir tuzağa çevirir. Ücretsiz katman gerçekten işe
 *    yaramazsa kimse ücretliye de geçmez.
 */

/** Ücretsiz katmanda satır sınırları. null = sınırsız, 0 = özellik kapalı. */
export const UCRETSIZ_LIMIT = {
  dava: 5,
  muvekkil: 10,
  belge: 5,
  finans: 0,
} as const;

export type PlanLimitTuru = keyof typeof UCRETSIZ_LIMIT;

/**
 * Sunucudan gelen 'plan_limiti:<tür>:<limit>' hatasını ayrıştırır.
 *
 * Tetikleyici bilerek makine okunur bir mesaj üretiyor: serbest metin bir hata
 * kullanıcıya ham İngilizce Postgres çıktısı gösterirdi.
 */
export function planLimitiCoz(mesaj: string | undefined | null): { tur: PlanLimitTuru; limit: number } | null {
  const m = /plan_limiti:([a-z]+):(\d+)/.exec(mesaj ?? '');
  if (!m) return null;
  const tur = m[1] as PlanLimitTuru;
  if (!(tur in UCRETSIZ_LIMIT)) return null;
  return { tur, limit: Number(m[2]) };
}
