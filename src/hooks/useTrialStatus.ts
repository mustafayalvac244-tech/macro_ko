import { useAuthStore } from '@/store/authStore';

/** Aylık abonelik ücreti (TL). */
export const MONTHLY_PRICE_TRY = 399;
/**
 * AI katmanı aylık ücreti (TL) — Claude Sonnet 5, 250 soru + 12 mütalaa dahil
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
export const AI_SORU_HAKKI = 250;
export const AI_MUTALAA_HAKKI = 12;
/** Ödeme yapmamış kullanıcıya verilen YAŞAM BOYU (aylık değil) deneme sorusu
 *  sayısı — bkz. _shared/katman.ts > DENEME_SORU_LIMIT, gerçek sınır orada. */
export const DENEME_SORU_HAKKI = 3;

export interface TrialStatus {
  /** Abone mi (ödeme yaptı / premium verildi)? */
  subscribed: boolean;
}

/**
 * KALDIRILAN "7 GÜNLÜK ÜCRETSİZ DENEME" — neden.
 *
 * Burada hesabın açılış tarihinden 7 gün sayan bir deneme sayacı vardı ve
 * ekranlar "7 GÜN ÜCRETSİZ", "denemenizin son günü", "deneme süresi bitmeden
 * iptal ederseniz ücret alınmaz" diyordu. ÖLÇÜLEN GERÇEK: bu denemenin hiçbir
 * karşılığı yoktu. Sınırı uygulayan tek yer `plan_limiti_kontrol`
 * tetikleyicisidir (migration 0087) ve o tetikleyicide deneme diye bir kavram
 * yok — 1. gündeki kullanıcı da 100. gündeki kullanıcı da aynı 5 dava sınırına
 * çarpıyordu. Yani ekranda satılan deneme, sunucuda hiç var olmadı.
 *
 * Üstelik App Store'da yapılandırılmış bir tanıtım teklifi (introductory
 * offer) da yok; "ilk 7 gün ücretsiz, iptal ederseniz ücret alınmaz" cümlesi
 * hem yanlış hem de App Review 3.1.2 açısından risk.
 *
 * Doğru çerçeve zaten üründe var: ücretsiz katman KALICI (sınırsız içtihat,
 * sınırsız ajanda; 5 dava / 10 müvekkil / 5 belge). Hiçbir şey "bitmiyor",
 * bu yüzden geri sayım da, "deneme bitti" uyarısı da kaldırıldı.
 *
 * GERÇEK bir deneme istenirse: App Store Connect / Play Console'da tanıtım
 * teklifi tanımlanır ve metinler oradaki şartlara göre yeniden yazılır —
 * uygulama içinde gün saymak o teklifin yerine geçmez.
 */
export function useTrialStatus(): TrialStatus {
  const profile = useAuthStore((s) => s.profile);
  return { subscribed: !!profile?.is_premium };
}
