// RevenueCat sarmalayıcısının WEB SÜRÜMÜ — bilerek boş.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA: purchases.ts, react-native-purchases'ı ÇALIŞMA ZAMANINDA
// import ediyor. O paket web'de @revenuecat/purchases-js-hybrid-mappings'i
// çekiyor ve bu, ölçülen web paketinde TEK BAŞINA 948 KB yer kaplıyordu
// (kaynak: entry.js source map'inin bayt dağılımı, 2026-09-10 ölçümü —
// 13.446.994 baytlık paketin %15,5'i). Platform.OS kontrolü bunu ÇÖZMEZ:
// Metro tree-shaking yapmadığı için modül, hiç çalışmasa bile pakete girer.
// Metro web'de önce *.web.ts dosyasını çözdüğü için bu dosya native kodu
// paketin DIŞINDA bırakır.
//
// DAVRANIŞ: purchases.ts zaten web'de "satın alma kapalı" davranıyordu
// (nativePlatform() false → configured false → her çağrı 'unavailable'/null).
// Buradaki karşılıkları AYNI sonuçları döndürür; yani web'de görünür bir
// davranış değişikliği YOKTUR, yalnız ölü kod paketten çıkar.
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

// Yalnız tip importu (derlemede silinir) — runtime'da react-native-purchases
// web paketine GİRMEZ.

export const PREMIUM_ENTITLEMENT_ID = 'premium';
export const AI_ENTITLEMENT_ID = 'ai';

export function configurePurchases(): void {
  // Web'de satın alma yok.
}

export async function identifyPurchaser(_userId: string): Promise<void> {
  // Web'de satın alma yok.
}

export async function resetPurchaser(): Promise<void> {
  // Web'de satın alma yok.
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  return null;
}

export async function getOffering(_identifier: string): Promise<PurchasesOffering | null> {
  return null;
}

export type PurchaseOutcome =
  | { kind: 'success'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

export async function buyPackage(_pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  return { kind: 'unavailable' };
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  return { kind: 'unavailable' };
}

export function isPremiumActive(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
}

export function isAiTierActive(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[AI_ENTITLEMENT_ID] !== 'undefined';
}

export async function refreshCustomerInfo(): Promise<CustomerInfo | null> {
  return null;
}
