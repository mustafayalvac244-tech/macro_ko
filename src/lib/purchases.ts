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
import { Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  AI_ENTITLEMENT_ID,
  PREMIUM_ENTITLEMENT_ID,
  abonelikYonetimAdresi,
  type PurchaseOutcome,
  type SatinAlmaHatasi,
} from '@/lib/satinAlma';

// Yetki kimlikleri ve sonuç tipi saf modülde (testte koşabilsin diye);
// eski içe aktarmalar kırılmasın diye buradan da dışa aktarılıyor.
export { AI_ENTITLEMENT_ID, PREMIUM_ENTITLEMENT_ID };
export type { PurchaseOutcome, SatinAlmaHatasi };

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
 *
 * Buradaki hata yutulur (açılışta para hareketi yok); satın alma ve geri
 * yükleme kimliği ayrıca kimligiDogrula ile yeniden doğrular, bağlanamazsa
 * işlemi başlatmaz.
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

/**
 * ÖDEME DOĞRU HESABA YAZILSIN — satın alma ve geri yüklemeden HEMEN ÖNCE.
 *
 * BULUNAN HATA (09.10.2026). Kimlik yalnız açılışta identifyPurchaser ile
 * bağlanıyordu ve logIn hatası yutuluyordu. logIn düşerse (ağ kesintisi,
 * RevenueCat arızası) SDK o oturum boyunca anonim kimlikte ($RCAnonymousID:…)
 * ya da önceki kullanıcının kimliğinde kalıyordu ve satın alma o kimliğe
 * yazılıyordu. Webhook yalnız UUID biçimli app_user_id işler
 * (revenuecat-webhook/index.ts) — anonim satın alma sunucuda ATLANIR:
 * kullanıcı öder, hesabında Pro açılmaz. Önceki kullanıcının kimliğinde
 * kalınırsa daha kötüsü: ödemeyi bu kullanıcı yapar, Pro ötekinde açılır.
 * Geri yükleme de aynı yoldan aboneliği hesaptan anonim kimliğe taşıyabilir
 * (RevenueCat "identifying customers" belgesi: aktarım davranışına göre).
 *
 * Kimlik zaten doğruysa (normal akış, mağaza incelemesi dahil) akış eskisiyle
 * aynıdır: yalnız getAppUserID okunur — köprü onu SDK'nın tuttuğu kimlikten
 * doğrudan döndürüyor (react-native-purchases 10.9.0: ios/RNPurchases.m
 * getAppUserID, android RNPurchasesModule.getAppUserID), logIn çağrılmaz.
 * Bağlanamıyorsa işlem BAŞLATILMAZ — ücret alınmadan hata söylenir.
 */
async function kimligiDogrula(kullaniciId: string | null | undefined): Promise<SatinAlmaHatasi | null> {
  if (!kullaniciId) return 'oturum_yok';
  try {
    if ((await Purchases.getAppUserID()) === kullaniciId) return null;
  } catch {
    // Okunamadıysa karar aşağıdaki logIn'in.
  }
  try {
    await Purchases.logIn(kullaniciId);
    return null;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logIn (satın alma öncesi) hatası:', e);
    return 'kimlik';
  }
}

/**
 * SDK hata kodu → kullanıcıya söylenecek neden. Kodlar SDK'nın kendi
 * sabitlerinden (PURCHASES_ERROR_CODE); listede olmayan her kod 'bilinmeyen'.
 */
function hataNedeni(kod: string | undefined): SatinAlmaHatasi {
  switch (kod) {
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
    case PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR:
      return 'ag';
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return 'izin_yok';
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return 'bekliyor';
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return 'zaten_var';
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return 'urun_yok';
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
    case PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      return 'baska_hesap';
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return 'magaza';
    default:
      return 'bilinmeyen';
  }
}

/** SDK'nın reddini sonuca çevirir. Ham İngilizce metin yalnız geliştirme günlüğüne gider. */
function hataSonucu(e: unknown, islem: string): PurchaseOutcome {
  const err = e as { code?: string; message?: string };
  if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
  if (__DEV__) console.warn(`RevenueCat ${islem} hatası:`, err?.code, err?.message);
  return { kind: 'error', neden: hataNedeni(err?.code) };
}

/**
 * Bir paketi oturumdaki kullanıcı ADINA satın alır. Kullanıcı vazgeçerse hata
 * değil 'cancelled' döner.
 */
export async function buyPackage(pkg: PurchasesPackage, kullaniciId: string | null | undefined): Promise<PurchaseOutcome> {
  if (!configured) return { kind: 'unavailable' };
  const kimlikHatasi = await kimligiDogrula(kullaniciId);
  if (kimlikHatasi) return { kind: 'error', neden: kimlikHatasi };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: 'success', customerInfo };
  } catch (e) {
    return hataSonucu(e, 'satın alma');
  }
}

/** Apple/Google incelemesi ZORUNLU tutar: önceki satın almayı bu hesaba geri yükler. */
export async function restorePurchases(kullaniciId: string | null | undefined): Promise<PurchaseOutcome> {
  if (!configured) return { kind: 'unavailable' };
  const kimlikHatasi = await kimligiDogrula(kullaniciId);
  if (kimlikHatasi) return { kind: 'error', neden: kimlikHatasi };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { kind: 'success', customerInfo };
  } catch (e) {
    return hataSonucu(e, 'geri yükleme');
  }
}

/**
 * Mağazanın abonelik sayfasını açar (yönet / iptal et). RevenueCat kurulu
 * olmasa da çalışır; açılamazsa false döner. Adresler ve kaynakları:
 * satinAlma.ts > abonelikYonetimAdresi.
 */
export async function aboneligiYonet(): Promise<boolean> {
  const adres = abonelikYonetimAdresi(Platform.OS);
  if (!adres) return false;
  try {
    await Linking.openURL(adres);
    return true;
  } catch {
    return false;
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
