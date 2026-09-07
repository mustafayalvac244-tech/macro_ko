// RevenueCat sarmalayıcı — gerçek satın alma (IAP) burada tek yerden yönetilir.
// ---------------------------------------------------------------------------
// RevenueCat yalnız iOS/Android NATİF modülüdür (Expo Go'da ve web'de
// ÇALIŞMAZ). Bu dosyadaki her fonksiyon web'de ve API anahtarı yokken
// SESSİZCE hiçbir şey yapmaz — çökme yerine "satın alma kapalı" davranışı.
//
// SUNUCUDAKİ TEK DOĞRULUK KAYNAĞI purchases tablosu ve profiles.is_premium
// (bkz. supabase/functions/revenuecat-webhook, migration 0072). Bu dosya
// yalnız İSTEMCİDEKİ satın alma akışını (teklif göster → satın al → geri
// yükle) yürütür; premium'un GERÇEKTEN açık kalması RevenueCat'in sunucuya
// gönderdiği webhook'a bağlıdır — istemci burada "başarılı" görse bile son
// söz sunucudadır.
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/** RevenueCat panelinde AYNI kimlikle tanımlanması gereken yetki (entitlement). */
export const PREMIUM_ENTITLEMENT_ID = 'premium';
/** AI katmanı yetkisi (1.499₺/ay, 250 soru + 12 mütalaa) — bkz. IAP_KURULUM.md. */
export const AI_ENTITLEMENT_ID = 'ai';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let configured = false;

function nativePlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Uygulama açılışında BİR KEZ çağrılır (bkz. app/_layout.tsx). Kullanıcı
 * girişi BEKLENMEZ — RevenueCat kendi anonim kimliğiyle başlar, oturum
 * belli olunca identifyPurchaser ile gerçek kullanıcıya bağlanır.
 */
export function configurePurchases(): void {
  if (configured || !nativePlatform()) return;
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) {
    if (__DEV__) console.warn('RevenueCat: API anahtarı ayarlanmamış, satın alma kapalı.');
    return;
  }
  // Native modül OTA ile gelen bir eski binary'de DERLENMEMİŞ olabilir (bkz.
  // IAP_KURULUM.md) — bu durumda Purchases.configure() senkron throw eder
  // (react-native-purchases/dist/purchases.js: throwIfNativeModuleNotAvailable).
  // try/catch olmadan bu, RootLayout'un mount effect'inde YAKALANMAYAN bir
  // hataya dönüşüp UYGULAMAYI ÇÖKERTİR — ErrorBoundary burayı KAPSAMAZ
  // (effect, ErrorBoundary'nin SARDIĞI alt ağacın DIŞINDA çalışır).
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat configure hatası (native modül eksik olabilir):', e);
  }
}

/**
 * RevenueCat kimliğini Supabase kullanıcı kimliğiyle eşler. Webhook, gelen
 * olaydaki app_user_id'yi DOĞRUDAN profiles.id olarak kullanıyor (bkz.
 * revenuecat-webhook/index.ts) — bu çağrı yapılmazsa satın alma RevenueCat'e
 * kaydedilir ama sunucu kimin aldığını bilemez.
 */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logIn hatası:', e);
  }
}

/** Çıkış yapınca çağrılır — sonraki kullanıcının satın alma geçmişi karışmasın. */
export async function resetPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logOut hatası:', e);
  }
}

/** RevenueCat panelinde tanımlı güncel (varsayılan) teklifi döner; yoksa/hataysa null. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat getOfferings hatası:', e);
    return null;
  }
}

/**
 * Kimlikle ADLANDIRILMIŞ bir teklifi döner — "AI" katmanı gibi varsayılan
 * dışındaki ikinci ürün için. RevenueCat panelinde AYNI kimlikle bir Offering
 * oluşturulmalı (bkz. IAP_KURULUM.md); yoksa/hataysa null döner ve çağıran
 * taraf zaten "çok yakında" davranışına düşer.
 */
export async function getOffering(identifier: string): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[identifier] ?? null;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat getOfferings hatası:', e);
    return null;
  }
}

export type PurchaseOutcome =
  | { kind: 'success'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

/** Bir paketi satın alır. Kullanıcı vazgeçerse hata değil 'cancelled' döner. */
export async function buyPackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!configured) return { kind: 'unavailable' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: 'success', customerInfo };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
    return { kind: 'error', message: err.message ?? 'satın alma başarısız' };
  }
}

/** Apple/Google incelemesi ZORUNLU tutar: önceki satın almayı geri yükler. */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!configured) return { kind: 'unavailable' };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { kind: 'success', customerInfo };
  } catch (e) {
    return { kind: 'error', message: (e as Error).message ?? 'geri yükleme başarısız' };
  }
}

export function isPremiumActive(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
}

export function isAiTierActive(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[AI_ENTITLEMENT_ID] !== 'undefined';
}

/** Güncel müşteri bilgisini sunucuya sormadan (RevenueCat önbelleğinden) döner. */
export async function refreshCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat getCustomerInfo hatası:', e);
    return null;
  }
}
