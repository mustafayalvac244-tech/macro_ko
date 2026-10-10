import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { QueryClient, defaultShouldDehydrateQuery, focusManager, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onbellegeYazilsinMi } from '@/lib/onbellekKurali';
import {
  QUERY_CACHE_MAX_AGE,
  QUERY_CACHE_SEMA,
  QUERY_VARSAYILANLARI,
  odakYonetimineBagla,
  queryCacheBuster,
} from './queryAyarlari';

/**
 * SORGU ÖNBELLEĞİ VE ONUN CİHAZDAKİ KOPYASI — tek yerden.
 *
 * NEDEN AYRI DOSYAYA TAŞINDI. QueryClient ve kalıcı önbellek app/_layout.tsx
 * içinde tanımlıydı; oradan başka bir modülün (özellikle authStore'un) erişmesi
 * mümkün değildi. Bu, aşağıdaki açığın kapatılamamasının teknik sebebiydi.
 *
 * KAPATILAN AÇIK: ÇIKIŞ YAPINCA VERİ CİHAZDA KALIYORDU.
 *
 * Çevrimdışı dayanıklılık için sorgu önbelleği cihaza yazılıyor (avukat
 * adliyede çekmeyen bir yerde ajandasını görebilsin diye — doğru bir karar).
 * Ama `signOut` yalnız oturumu kapatıyordu: davalar, müvekkil adları, duruşma
 * kayıtları AsyncStorage'daki VEKIL_QUERY_CACHE anahtarında DURMAYA DEVAM
 * ediyordu.
 *
 * Bu bir hukuk uygulamasında sıradan bir önbellek artığı değil: "çıkış yaptım"
 * diyen avukat, müvekkil verisinin o cihazda kalmadığını varsayar. Ortak
 * kullanılan, devredilen ya da servise verilen bir telefonda bu varsayımın
 * yanlış olması sır saklama yükümlülüğüyle çelişir.
 *
 * DÜRÜSTLÜK NOTU: verinin cihazda KALDIĞI koddan doğrulanabilir bir olgudur
 * (çıkışta önbelleği temizleyen hiçbir çağrı yoktu). Bu artığın üçüncü bir
 * kişi tarafından GERÇEKTEN okunup okunamayacağı cihazın kendi güvenliğine
 * bağlıdır ve ÖLÇÜLMEDİ — root'lu bir cihazda ya da yedek üzerinden okuma
 * denenmedi. Temizlemek, ölçümden bağımsız olarak doğru davranıştır.
 */

/** Kalıcı önbelleğin AsyncStorage anahtarı. */
export const QUERY_CACHE_KEY = 'VEKIL_QUERY_CACHE';

/** Önbelleğin cihazda saklanma süresi (tanım: queryAyarlari.ts, saf ve testli). */
export { QUERY_CACHE_MAX_AGE };

/** Kalıcı önbellek sürüm damgası — bkz. queryAyarlari.queryCacheBuster. */
export const QUERY_CACHE_BUSTER = queryCacheBuster(QUERY_CACHE_SEMA, Constants.expoConfig?.version);

export const queryClient = new QueryClient({ defaultOptions: QUERY_VARSAYILANLARI });

// Natifte uygulama arka plandan öne gelince sorgular tazelensin (web'de
// tarayıcının görünürlük olayı zaten çalışıyor). Ağ DEĞİŞİMİ (onlineManager)
// natifte HÂLÂ bağlı değil: bunun için @react-native-community/netinfo ya da
// expo-network gerekir, ikisi de projede yok (yeni bağımlılık = derleme).
if (Platform.OS !== 'web') odakYonetimineBagla(focusManager, AppState);

export const asyncPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
});

/**
 * Cihaza yazılacak sorgular: varsayılan kural (yalnız başarılı olanlar) VE
 * yönetici paneli verisi hariç (bkz. onbellekKurali.ts).
 */
export const kalicidaTutulsunMu = (sorgu: Query): boolean =>
  defaultShouldDehydrateQuery(sorgu) && onbellegeYazilsinMi(sorgu.queryKey);

/**
 * Bellekteki ve cihazdaki tüm sorgu verisini siler. Çıkışta ve hesap silmede
 * çağrılır.
 *
 * SIRA: önce bellek temizlenir, sonra cihazdaki kopya. Ters sırada, kalıcı
 * yazıcının bekleyen (throttle'lanmış) yazımı silinen anahtarı yeniden
 * oluşturabilirdi. Bu sırada bekleyen bir yazım kalsa bile artık BOŞ önbelleği
 * yazar.
 */
export async function resetQueryCache(): Promise<void> {
  queryClient.clear();
  // removeClient senkron da olabilir (Promisable<void>); Promise.resolve ile
  // sarmak iki hâli de kapsar ve hata çıkışı engellemez.
  await Promise.resolve(asyncPersister.removeClient()).catch(() => {});
}
