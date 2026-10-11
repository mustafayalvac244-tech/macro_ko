import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PURCHASES_ERROR_CODE } from '@revenuecat/purchases-typescript-internal';
import type { PurchasesPackage } from 'react-native-purchases';

/**
 * SATIN ALMA İSTEMCİSİ — src/lib/purchases.ts (09.10.2026 denetimi).
 *
 * Natif RevenueCat modülü yerine kayıt tutan bir taklit kullanılır: hangi
 * kimlikle satın alındığı / geri yüklendiği buradan okunur. Hata kodları
 * taklitte uydurulmaz, kurulu SDK'nın kendi PURCHASES_ERROR_CODE'undan gelir
 * (@revenuecat/purchases-typescript-internal) — SDK kodları değiştirirse bu
 * dosya düşer.
 *
 * Korunan iki şey:
 *  1. ÖDEME YANLIŞ KİMLİĞE YAZILMAZ. Webhook yalnız UUID biçimli app_user_id
 *     işler (revenuecat-webhook/index.ts) — anonim kimlikle yapılan satın alma
 *     sunucuda ATLANIR: kullanıcı öder, hesabında Pro açılmaz. Açılıştaki
 *     logIn hatası yutulduğu için bu yol açıktı.
 *  2. Kullanıcıya SDK'nın İngilizce ham hata metni gitmez; neden döner,
 *     metni ekran i18n'den seçer.
 */

const rc = vi.hoisted(() => ({
  kimlik: '',
  logInDusur: false,
  cagrilar: [] as string[],
  hata: null as null | { code: string; message: string },
  aktif: {} as Record<string, unknown>,
  acilan: [] as string[],
  acilmasin: false,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: {
    openURL: async (adres: string) => {
      if (rc.acilmasin) throw new Error('açılamadı');
      rc.acilan.push(adres);
    },
  },
}));

vi.mock('react-native-purchases', async () => {
  const sdk = await import('@revenuecat/purchases-typescript-internal');
  const musteri = () => ({ entitlements: { active: { ...rc.aktif } } });
  return {
    default: {
      setLogLevel: () => {},
      configure: () => {},
      getAppUserID: async () => rc.kimlik,
      logIn: async (id: string) => {
        rc.cagrilar.push(`logIn:${id}`);
        if (rc.logInDusur) {
          throw Object.assign(new Error('Error performing request.'), { code: sdk.PURCHASES_ERROR_CODE.NETWORK_ERROR });
        }
        rc.kimlik = id;
        return { customerInfo: musteri(), created: false };
      },
      logOut: async () => musteri(),
      purchasePackage: async () => {
        rc.cagrilar.push(`satinAl:${rc.kimlik}`);
        if (rc.hata) throw rc.hata;
        return { customerInfo: musteri(), productIdentifier: 'vekil_premium_monthly' };
      },
      restorePurchases: async () => {
        rc.cagrilar.push(`geriYukle:${rc.kimlik}`);
        if (rc.hata) throw rc.hata;
        return musteri();
      },
      getCustomerInfo: async () => musteri(),
    },
    LOG_LEVEL: { WARN: 'WARN' },
    PURCHASES_ERROR_CODE: sdk.PURCHASES_ERROR_CODE,
  };
});

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'taklit_anahtar');
const p = await import('@/lib/purchases');
p.configurePurchases();

const KULLANICI = '3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab';
const ONCEKI_KULLANICI = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ANONIM = '$RCAnonymousID:9c0ffee';
const paket = { identifier: '$rc_monthly' } as unknown as PurchasesPackage;

beforeEach(() => {
  rc.kimlik = ANONIM;
  rc.logInDusur = false;
  rc.cagrilar = [];
  rc.hata = null;
  rc.aktif = {};
  rc.acilan = [];
  rc.acilmasin = false;
});

describe('satın alma doğru hesaba yazılır', () => {
  it('açılıştaki logIn düştüyse ve yine bağlanamıyorsa satın alma BAŞLAMAZ (anonim kimliğe ödeme yok)', async () => {
    rc.logInDusur = true;
    await p.identifyPurchaser(KULLANICI); // açılıştaki çağrı: hata yutulur
    const sonuc = await p.buyPackage(paket, KULLANICI);
    expect(rc.cagrilar.filter((c) => c.startsWith('satinAl:'))).toEqual([]);
    expect(sonuc).toEqual({ kind: 'error', neden: 'kimlik' });
  });

  it('kimlik eksikse önce hesaba bağlar, ödeme hesabın kimliğiyle yapılır', async () => {
    const sonuc = await p.buyPackage(paket, KULLANICI);
    expect(sonuc.kind).toBe('success');
    expect(rc.cagrilar).toEqual([`logIn:${KULLANICI}`, `satinAl:${KULLANICI}`]);
  });

  it('RevenueCat önceki kullanıcıda kaldıysa ödeme ona yazılmaz', async () => {
    rc.kimlik = ONCEKI_KULLANICI;
    rc.logInDusur = true;
    const sonuc = await p.buyPackage(paket, KULLANICI);
    expect(rc.cagrilar.some((c) => c.startsWith('satinAl:'))).toBe(false);
    expect(sonuc).toEqual({ kind: 'error', neden: 'kimlik' });
  });

  it('oturum yoksa satın alma başlamaz', async () => {
    const sonuc = await p.buyPackage(paket, undefined);
    expect(rc.cagrilar).toEqual([]);
    expect(sonuc).toEqual({ kind: 'error', neden: 'oturum_yok' });
  });

  it('kimlik zaten doğruysa akış eskisi gibi: fazladan logIn yok (inceleme yolu değişmez)', async () => {
    rc.kimlik = KULLANICI;
    const sonuc = await p.buyPackage(paket, KULLANICI);
    expect(sonuc.kind).toBe('success');
    expect(rc.cagrilar).toEqual([`satinAl:${KULLANICI}`]);
  });

  it('geri yükleme de anonim kimlikle yapılmaz (aboneliği hesaptan anonime taşıyabilirdi)', async () => {
    rc.logInDusur = true;
    const sonuc = await p.restorePurchases(KULLANICI);
    expect(rc.cagrilar.some((c) => c.startsWith('geriYukle:'))).toBe(false);
    expect(sonuc).toEqual({ kind: 'error', neden: 'kimlik' });
  });

  it('geri yükleme hesabın kimliğiyle yapılır', async () => {
    const sonuc = await p.restorePurchases(KULLANICI);
    expect(sonuc.kind).toBe('success');
    expect(rc.cagrilar).toEqual([`logIn:${KULLANICI}`, `geriYukle:${KULLANICI}`]);
  });
});

describe('kullanıcıya ham SDK metni gitmez', () => {
  it('ağ hatasında sonuç yalnız neden taşır, İngilizce metin taşımaz', async () => {
    rc.kimlik = KULLANICI;
    rc.hata = { code: PURCHASES_ERROR_CODE.NETWORK_ERROR, message: 'Error performing request.' };
    const sonuc = await p.buyPackage(paket, KULLANICI);
    expect(sonuc).toEqual({ kind: 'error', neden: 'ag' });
    expect(JSON.stringify(sonuc)).not.toContain('Error performing request');
  });

  it.each([
    [PURCHASES_ERROR_CODE.NETWORK_ERROR, 'ag'],
    [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR, 'ag'],
    [PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR, 'ag'],
    [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR, 'izin_yok'],
    [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR, 'bekliyor'],
    [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR, 'zaten_var'],
    [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR, 'urun_yok'],
    [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR, 'baska_hesap'],
    [PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR, 'baska_hesap'],
    [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR, 'magaza'],
    [PURCHASES_ERROR_CODE.CONFIGURATION_ERROR, 'bilinmeyen'],
    [PURCHASES_ERROR_CODE.UNKNOWN_ERROR, 'bilinmeyen'],
  ])('SDK kodu %s → %s', async (kod, neden) => {
    rc.kimlik = KULLANICI;
    rc.hata = { code: kod, message: 'raw sdk text' };
    expect(await p.buyPackage(paket, KULLANICI)).toEqual({ kind: 'error', neden });
    expect(await p.restorePurchases(KULLANICI)).toEqual({ kind: 'error', neden });
  });

  it('vazgeçme hata sayılmaz', async () => {
    rc.kimlik = KULLANICI;
    rc.hata = { code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR, message: 'Purchase was cancelled.' };
    expect(await p.buyPackage(paket, KULLANICI)).toEqual({ kind: 'cancelled' });
  });
});

describe('aboneliği yönet', () => {
  it('iOS\'ta App Store abonelik sayfasını açar — RevenueCat\'e ve oturuma bağlı değil', async () => {
    expect(await p.aboneligiYonet()).toBe(true);
    expect(rc.acilan).toEqual(['https://apps.apple.com/account/subscriptions']);
    expect(rc.cagrilar).toEqual([]);
  });

  it('açılamazsa false döner (ekran yolu söyler)', async () => {
    rc.acilmasin = true;
    expect(await p.aboneligiYonet()).toBe(false);
  });
});
