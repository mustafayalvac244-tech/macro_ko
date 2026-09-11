import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { cihazAdiUret, isletimAdi, tarayiciAdi } from '@/utils/cihazAdi';

/**
 * CİHAZ ANAHTARI VE KÜNYESİ.
 *
 * Anahtar, bu kurulumu diğerlerinden ayırmak için üretilen RASTGELE bir
 * değerdir. Donanım kimliği (IMEI, seri no, reklam kimliği) KULLANILMAZ —
 * onlar kalıcı takip kimlikleridir ve mağaza kurallarına da takılır.
 *
 * SAKLAMA YERİ:
 *   natif → SecureStore (Keychain/Keystore). Uygulama silinince gider; bu
 *           kabul edilebilir, yeni kurulum zaten yeni cihaz sayılmalı.
 *   web   → localStorage. Gizli sekmede ve site verisi temizlenince gider;
 *           o zaman kullanıcı "yeni cihaz" uyarısı alır. YANLIŞ POZİTİF
 *           olduğunu biliyoruz ve uyarı metni de "tanımadıysanız" diye
 *           yazıldı — sessizce yanıltmıyoruz.
 *
 * ABARTMA YOK: bu anahtar istemcide üretilir ve istemciden gönderilir. Kötü
 * niyetli bir istemci başka bir anahtarı taklit edebilir. Amaç saldırganı
 * ENGELLEMEK değil, meşru kullanıcının durumu FARK ETMESİNİ sağlamaktır.
 */

const ANAHTAR_ADI = 'vekil_cihaz_anahtari';

function rastgele(): string {
  // crypto.randomUUID her iki platformda da (RN 0.86 / modern tarayıcı) var;
  // yoksa Math.random'a düşülür — kriptografik olması gerekmiyor, yalnız
  // çakışmayacak kadar benzersiz olması yeterli.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function webOku(): string | null {
  try {
    return globalThis.localStorage?.getItem(ANAHTAR_ADI) ?? null;
  } catch {
    // Gizli sekme / depolama engelli
    return null;
  }
}

function webYaz(v: string): void {
  try {
    globalThis.localStorage?.setItem(ANAHTAR_ADI, v);
  } catch {
    // yazılamadıysa her açılışta yeni anahtar üretilir; uyarı çıkar, veri sızmaz
  }
}

let bellek: string | null = null;

/** Bu kurulumun kalıcı anahtarı. Yoksa üretip saklar. */
export async function cihazAnahtari(): Promise<string> {
  if (bellek) return bellek;

  if (Platform.OS === 'web') {
    const v = webOku() ?? rastgele();
    webYaz(v);
    bellek = v;
    return v;
  }

  try {
    const mevcut = await SecureStore.getItemAsync(ANAHTAR_ADI);
    if (mevcut) {
      bellek = mevcut;
      return mevcut;
    }
    const yeni = rastgele();
    await SecureStore.setItemAsync(ANAHTAR_ADI, yeni);
    bellek = yeni;
    return yeni;
  } catch {
    // SecureStore erişilemezse oturum boyunca geçerli bir anahtar kullan.
    bellek = bellek ?? rastgele();
    return bellek;
  }
}

export interface CihazKunyesi {
  anahtar: string;
  ad: string;
  platform: string;
  surum: string;
}

/** Sunucuya gönderilecek cihaz künyesi. */
export async function cihazKunyesi(): Promise<CihazKunyesi> {
  const ua =
    Platform.OS === 'web'
      ? (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? ''
      : '';

  return {
    anahtar: await cihazAnahtari(),
    ad: cihazAdiUret({
      marka: Device.brand,
      model: Device.modelName,
      platform: Platform.OS,
      tarayici: tarayiciAdi(ua),
      isletim: Platform.OS === 'web' ? isletimAdi(ua) : Device.osName,
    }),
    platform: Platform.OS,
    surum: Constants.expoConfig?.version ?? '',
  };
}
