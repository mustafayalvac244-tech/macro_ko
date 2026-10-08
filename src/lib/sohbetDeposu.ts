import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * YAPAY ZEKÂ SOHBET GEÇMİŞİ — HESABA BAĞLI CİHAZ DEPOSU (08.10.2026).
 *
 * BULUNAN KUSUR (50 denetçi taraması, kodla doğrulandı). Geçmiş tek ve genel
 * bir anahtarda ('vekil.ai.conversations.v2') duruyordu; çıkışta ve hesap
 * silmede temizlenmiyordu. Ortak bilgisayarda (web) ya da devredilen telefonda
 * avukat A çıkış yapıp B girdiğinde, B geçmiş panelinde A'nın müvekkil
 * sorularını ve cevaplarını görüyordu.
 *
 * Artık anahtar kullanıcı kimliğini taşır ve çıkışta/hesap silmede silinir —
 * sorgu önbelleği ve yerel bildirimler için zaten uygulanan "çıkışta müvekkil
 * verisi cihazda kalmaz" kuralının aynısı (bkz. authStore.signOut).
 */
const ESKI_ANAHTAR = 'vekil.ai.conversations.v2';

export function sohbetAnahtari(userId: string): string {
  return `vekil.ai.conversations.v3:${userId}`;
}

/**
 * Hesabın geçmişini okur. Eski genel anahtardaki geçmiş, güncellemeden sonra
 * ilk giren hesaba BİR KEZ taşınır ve genel anahtar silinir (cihazların çoğu
 * tek kullanıcılı; taşımasak her avukatın geçmişi güncellemede kaybolurdu).
 */
export async function sohbetleriOku(userId: string): Promise<string | null> {
  const anahtar = sohbetAnahtari(userId);
  const mevcut = await AsyncStorage.getItem(anahtar);
  if (mevcut != null) return mevcut;
  const eski = await AsyncStorage.getItem(ESKI_ANAHTAR);
  if (eski == null) return null;
  await AsyncStorage.setItem(anahtar, eski);
  await AsyncStorage.removeItem(ESKI_ANAHTAR);
  return eski;
}

export async function sohbetleriYaz(userId: string, json: string): Promise<void> {
  await AsyncStorage.setItem(sohbetAnahtari(userId), json);
}

/** Çıkışta ve hesap silmede: bu hesabın geçmişi (ve eski genel anahtar) silinir. */
export async function sohbetGecmisiniSil(userId: string | null | undefined): Promise<void> {
  const anahtarlar = [ESKI_ANAHTAR];
  if (userId) anahtarlar.push(sohbetAnahtari(userId), ...taslakAnahtarlari(userId));
  await AsyncStorage.multiRemove(anahtarlar);
}

/**
 * YAPAY ZEKÂ TASLAĞI — cihazda, hesaba bağlı (08.10.2026).
 *
 * Dilekçe taslağı yalnız ekran durumunda duruyordu: 58 sn bekleyip hak
 * harcayan, sonra 20 dk elle düzelten avukat geri/yenile/yan menüyle çıkınca
 * her şey gidiyordu. Son taslak burada tutulur; sohbet geçmişiyle aynı kural:
 * çıkışta ve hesap silmede silinir (sohbetGecmisiniSil).
 */
export type TaslakEkrani = 'dilekce';
const TASLAK_EKRANLARI: TaslakEkrani[] = ['dilekce'];
const taslakAnahtari = (userId: string, ekran: TaslakEkrani) => `vekil.ai.taslak.v1:${ekran}:${userId}`;

export async function taslakOku<T>(userId: string, ekran: TaslakEkrani): Promise<T | null> {
  try {
    const ham = await AsyncStorage.getItem(taslakAnahtari(userId, ekran));
    return ham ? (JSON.parse(ham) as T) : null;
  } catch {
    return null;
  }
}

export async function taslakYaz(userId: string, ekran: TaslakEkrani, veri: unknown): Promise<void> {
  await AsyncStorage.setItem(taslakAnahtari(userId, ekran), JSON.stringify(veri)).catch(() => {});
}

export async function taslakSil(userId: string, ekran: TaslakEkrani): Promise<void> {
  await AsyncStorage.removeItem(taslakAnahtari(userId, ekran)).catch(() => {});
}

export function taslakAnahtarlari(userId: string): string[] {
  return TASLAK_EKRANLARI.map((e) => taslakAnahtari(userId, e));
}
