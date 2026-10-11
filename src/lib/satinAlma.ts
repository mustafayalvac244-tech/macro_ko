/**
 * SATIN ALMA — saf kısım (react-native / react-native-purchases içe aktarmaz,
 * vitest'te koşar). Natif akış: src/lib/purchases.ts · web: purchases.web.ts ·
 * ekran: app/premium.tsx. Testler: tests/satinAlma*.test.ts.
 */
import type { CustomerInfo } from 'react-native-purchases';
import type { TKey } from '@/i18n';

/** RevenueCat panelindeki yetki (entitlement) kimlikleri — bkz. IAP_KURULUM.md §4. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';
/** AI katmanı yetkisi (2.999₺/ay) — bkz. IAP_KURULUM.md. */
export const AI_ENTITLEMENT_ID = 'ai';

/**
 * Satın alma / geri yükleme NEDEN olmadı. Kullanıcıya SDK'nın İngilizce ham
 * metni ("Error performing request.") gösterilmez; ekran bu nedene karşılık
 * gelen i18n metnini seçer (satinAlmaHataMesaji / geriYuklemeMesaji).
 */
export type SatinAlmaHatasi =
  | 'oturum_yok' // Vekil Pro hesabıyla giriş yok — satın alma kime yazılacak bilinmiyor
  | 'kimlik' // RevenueCat kimliği hesaba bağlanamadı — işlem BAŞLATILMADI
  | 'ag'
  | 'izin_yok'
  | 'bekliyor'
  | 'zaten_var'
  | 'urun_yok'
  | 'baska_hesap'
  | 'magaza'
  | 'bilinmeyen';

export type PurchaseOutcome =
  | { kind: 'success'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'error'; neden: SatinAlmaHatasi };

export interface Mesaj {
  baslik: TKey;
  govde: TKey;
}

const HATA_METNI: Record<SatinAlmaHatasi, TKey> = {
  oturum_yok: 'premium.hata.oturumYok',
  kimlik: 'premium.hata.kimlik',
  ag: 'premium.hata.ag',
  izin_yok: 'premium.hata.izinYok',
  bekliyor: 'premium.hata.bekliyor',
  zaten_var: 'premium.hata.zatenVar',
  urun_yok: 'premium.hata.urunYok',
  baska_hesap: 'premium.hata.baskaHesap',
  magaza: 'premium.hata.magaza',
  bilinmeyen: 'premium.hata.bilinmeyen',
};

/** Satın alma hatasında gösterilecek başlık ve metin. */
export function satinAlmaHataMesaji(neden: SatinAlmaHatasi): Mesaj {
  return {
    baslik: neden === 'bekliyor' ? 'premium.pendingTitle' : 'premium.purchaseFailedTitle',
    govde: HATA_METNI[neden],
  };
}

/** Müşteri bilgisinde Vekil Pro ya da Yapay Zekâ yetkisi ETKİN mi. */
export function aktifAbonelikVar(info: Pick<CustomerInfo, 'entitlements'>): boolean {
  const aktif = info.entitlements.active;
  return aktif[PREMIUM_ENTITLEMENT_ID] !== undefined || aktif[AI_ENTITLEMENT_ID] !== undefined;
}

/**
 * "Satın almaları geri yükle"nin sonucunda ne söyleneceği; null = hiçbir şey
 * gösterme (kullanıcı vazgeçti).
 *
 * BULUNAN HATA (09.10.2026). Ekran her başarılı yanıtta "Önceki aboneliğiniz
 * bulundu ve hesabınıza bağlandı" diyordu. Oysa RevenueCat'in
 * restorePurchases'ı geri yüklenecek HİÇBİR ŞEY yokken de başarıyla döner
 * (boş yetkili bir müşteri bilgisi). Kullanıcı aboneliği olmadığı hâlde
 * "bulundu" okuyordu. Ayrıca 'unavailable' (mağaza bağlantısı yok) dalı
 * "satın alma bulunamadı" diyordu — hiç bakılmamışken.
 */
export function geriYuklemeMesaji(sonuc: PurchaseOutcome): (Mesaj & { profilYenile: boolean }) | null {
  switch (sonuc.kind) {
    case 'success':
      return aktifAbonelikVar(sonuc.customerInfo)
        ? { baslik: 'premium.restoreDoneTitle', govde: 'premium.restoreDoneBody', profilYenile: true }
        : { baslik: 'premium.restoreDoneTitle', govde: 'premium.restoreNoneBody', profilYenile: false };
    case 'error':
      return { baslik: 'premium.restoreFailedTitle', govde: HATA_METNI[sonuc.neden], profilYenile: false };
    case 'unavailable':
      return { baslik: 'premium.soonTitle', govde: 'premium.restoreUnavailableBody', profilYenile: false };
    case 'cancelled':
      return null;
  }
}

/**
 * Ücretli bir plan açık mı — SUNUCUNUN kuralının aynısı (0087
 * plan_limiti_kontrol: `is_premium` ya da ai_tier 'free'/'baslangic' dışı ise
 * sınır yok).
 *
 * BULUNAN TUTARSIZLIK (09.10.2026). Ekran yalnız is_premium'a bakıyordu. AI
 * paketinin is_premium'u da açması RevenueCat panelindeki eşlemeye bağlı
 * (IAP_KURULUM.md §4: AI ürünü 'premium' yetkisine de bağlanmalı) ve bu eşleme
 * gerçek bir satın almada henüz doğrulanmadı. Eşleme eksikse AI abonesi
 * ekranda Pro'nun "Aboneliğe Geç" düğmesini görüp aynı abonelik grubunda bir
 * alt pakete geçişi başlatabilirdi; sunucu ise onu zaten sınırsız sayıyor.
 */
export function ucretliPlanAcik(
  profil: { is_premium?: boolean | null; ai_tier?: string | null } | null | undefined
): boolean {
  if (!profil) return false;
  if (profil.is_premium) return true;
  const katman = profil.ai_tier ?? 'free';
  return katman !== 'free' && katman !== 'baslangic';
}

/**
 * "Aboneliği yönet / iptal et" — mağazanın abonelik sayfası.
 * - iOS: Apple, StoreKit "Handling Subscriptions Billing": "For users who wish
 *   to cancel their subscription, your app can open the following URL:
 *   https://apps.apple.com/account/subscriptions" (09.10.2026 okundu).
 * - Android: developer.android.com/google/play/billing/subscriptions, "Link to
 *   the subscriptions center": https://play.google.com/store/account/subscriptions
 *   (09.10.2026 okundu).
 * Web'de mağaza yok → null.
 */
export function abonelikYonetimAdresi(os: string): string | null {
  if (os === 'ios') return 'https://apps.apple.com/account/subscriptions';
  if (os === 'android') return 'https://play.google.com/store/account/subscriptions';
  return null;
}
