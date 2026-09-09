import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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

/** Önbelleğin cihazda saklanma süresi. */
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000, gcTime: QUERY_CACHE_MAX_AGE },
  },
});

export const asyncPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
});

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
