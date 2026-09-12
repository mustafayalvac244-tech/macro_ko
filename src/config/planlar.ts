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

// ─────────────────────────────────────────────────────────────────────────
// FİYAT VE YAPAY ZEKÂ KOTASI — src/hooks/useTrialStatus.ts'ten taşındı.
// Orada durduklarında react-native'e bağlı bir dosyanın içindeydiler ve test
// edilemiyorlardı; docs/terms.html'in eski kotayı yazmaya devam etmesi de
// bu yüzden kimseye çarpmadı. Burası saf: tests/sozlesmeSayilari.test.ts
// artık bu sabitlerle web sözleşmesini karşılaştırıyor.
/** Aylık abonelik ücreti (TL). */
export const MONTHLY_PRICE_TRY = 399;
/**
 * AI katmanı aylık ücreti (TL) — 1.650 soru + 25 mütalaa dahil
 * (bkz. supabase/functions/_shared/katman.ts > AI_SORU_LIMIT/AI_MUTALAA_LIMIT;
 * iki sayı burada da AYNI olmalı, kota koddan, fiyat buradan okunuyor).
 *
 * 1.999 → 3.999 → 2.999 (2026-09-11, ürün kararı). Son değişiklik RAKİP
 * FİYATINA göre: Lexedes'in önerdiği "Bireysel" planı 2.990 ₺/ay (liste
 * 3.490) ve o plan bizim AI katmanımızla aynı işi hedefliyor — derin
 * içtihat/mevzuat araştırması, dilekçe üretimi, belge analizi. 3.999'da
 * rakibin önerdiği plandan %34 pahalıydık.
 *
 * Bu sayı yalnız EKRANDAKİ ve koşullardaki fiyattır; gerçek tahsilat mağaza ürününün fiyatıdır
 * (vekil_ai_monthly, App Store Connect / Play Console / RevenueCat). Üçü
 * birden güncellenmezse ekran bir şey yazar, kart başka bir şey çeker —
 * bu yüzden satın alma ekranı, teklif yüklendiyse mağazanın fiyatını
 * gösterir ve bu sabit yalnız yedek olarak kalır (app/premium.tsx).
 */
export const AI_PRICE_TRY = 2999;
/** AI katmanının aylık soru/mütalaa hakkı — yalnız EKRANDA göstermek için;
 *  gerçek sınır sunucuda (_shared/katman.ts). */
// KOTA YÜKSELTİLDİ (12.09.2026): 250 → 750 soru, 12 → 25 mütalaa.
// Eski paket Opus varsayımıyla kurulmuştu (istek başına ₺2,67); aynı gün
// Sonnet'e inildi ve ölçülen birim maliyet ₺1,07 oldu, yani paket gereğinden
// dar kaldı. Gerekçe ve hesap tek yerde:
// supabase/functions/_shared/katman.ts (AI_SORU_LIMIT).
//
// BURADAKİ SAYILAR YALNIZCA GÖSTERİM İÇİNDİR — gerçek kısıt uç işlevindedir.
// İkisi ayrışırsa doğru olan sunucudur; bu yüzden ikisi birlikte değişmeli.
export const AI_SORU_HAKKI = 1650;
export const AI_MUTALAA_HAKKI = 25;

/**
 * İlk kaç istek ASIL modelle yapılır. Sonrası aynı ay içinde daha hızlı,
 * daha hafif bir modele düşer — istek reddedilmez.
 *
 * Kullanıcıya söylenen toplam hak 1.650'dir çünkü GERÇEKTEN 1.650 istek
 * yapabiliyor. Ama 751. istekten sonra çıktıyı üreten model değişiyor ve
 * bunu söylememek, kullanıcının fark edeceği bir kalite değişikliğini
 * gizlemek olurdu. Sözleşme metni (app/terms.tsx m.5) bu ayrımı yazıyor.
 */
export const AI_ASIL_MODEL_HAKKI = 750;
/** Ödeme yapmamış kullanıcıya verilen YAŞAM BOYU (aylık değil) deneme sorusu
 *  sayısı — bkz. _shared/katman.ts > DENEME_SORU_LIMIT, gerçek sınır orada. */
export const DENEME_SORU_HAKKI = 3;
