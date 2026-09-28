// SÜRÜM — telefonda hangi paketin çalıştığının tek satırlık tarifi.
//
// Ayarlar → Sürüm'de görünür. Amaç, bir OTA güncellemesinin telefona gerçekten
// indiğini GÖRMEK: iş akışı yalnız "yayımlandı" diyebilir; indiğini ancak
// burada yazan kimlik kanıtlar (28.09.2026).
//
// Ekrandan ayrı, saf fonksiyon: vitest'te React Native olmadan sınanıyor.

import { bicimTarih } from './rapor';

/** expo-updates'in `useUpdates().currentlyRunning` alanlarından gerekenler. */
export type CalisanPaket = {
  isEmbeddedLaunch: boolean;
  updateId?: string | null;
  createdAt?: Date | null;
};

/** Kimliğin ilk bu kadar hanesi; OTA iş akışının özetindeki kimlikle eşleştirmeye yeter. */
export const KISA_KIMLIK = 8;

/**
 * "APK ile gelen paket · 28.09.2026 07:12" ya da
 * "Güncelleme 1a2b3c4d · 28.09.2026 07:40".
 *
 * APK'nın içindeki paketin de bir kimliği vardır; o yüzden ayrım kimliğin
 * varlığına değil `isEmbeddedLaunch`e bakılarak yapılır.
 */
export function calisanPaketMetni(p: CalisanPaket): string {
  const gecerliTarih = p.createdAt && !Number.isNaN(p.createdAt.getTime());
  const tarih = gecerliTarih ? bicimTarih(p.createdAt!.toISOString()) : '';
  const ad = p.isEmbeddedLaunch || !p.updateId
    ? 'APK ile gelen paket'
    : `Güncelleme ${p.updateId.slice(0, KISA_KIMLIK)}`;
  return tarih ? `${ad} · ${tarih}` : ad;
}
