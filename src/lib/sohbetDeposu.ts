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
  if (userId) anahtarlar.push(sohbetAnahtari(userId));
  await AsyncStorage.multiRemove(anahtarlar);
}
