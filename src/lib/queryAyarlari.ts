/**
 * SORGU İSTEMCİSİ AYARLARI — saf (react-native / AsyncStorage'sız), birim
 * testli (tests/queryAyarlari.test.ts). AJAN 28, 10.10.2026.
 * İstemcinin kendisi ve kalıcı yazıcı src/lib/queryClient.ts içinde.
 */

/** Önbelleğin cihazda saklanma süresi. */
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

/**
 * networkMode 'always' — WEB'DE SESSİZ BEKLEME YOK.
 *
 * Varsayılan 'online' kipinde tarayıcı "çevrimdışı" derse sorgu ve KAYDETME
 * isteği hiç gönderilmez, BEKLEMEYE alınır: kayıt düğmesi dönüp durur, hata
 * hiç gelmez (formlardaki "kaydetme başarısızsa kanca uyarı gösterir" varsayımı
 * çöker), liste ekranları ne veri ne hata gösterir. Natifte durum başka:
 * onlineManager'a ağ dinleyicisi bağlı değil, hep "çevrimiçi" sayılıyor, yani
 * istek gidiyor, düşüyor, hata görünüyor. 'always' web'i de aynı, bilinen
 * davranışa eşitler. ('offlineFirst' seçilmedi: React Query belgesine göre
 * ilk istek gider ama yeniden denemeler çevrimdışıyken bekler; bunu
 * çalıştırıp doğrulamadım, 'always' ise testle doğrulandı.)
 */
export const QUERY_VARSAYILANLARI = {
  queries: { retry: 2, staleTime: 60_000, gcTime: QUERY_CACHE_MAX_AGE, networkMode: 'always' as const },
  mutations: { networkMode: 'always' as const },
};

/**
 * KALICI ÖNBELLEK SÜRÜM DAMGASI (persistOptions.buster). Damga değişince
 * cihazdaki eski önbellek atılır; yoksa şeması değişmiş eski veri yeni kodla
 * okunurdu (alan eksik/yeni ad → ekran çöker ya da yanlış gösterir).
 *
 * QUERY_CACHE_SEMA: sorgu verisinin ŞEKLİNİ değiştiren her OTA'da elle artır
 * (uygulama sürümü OTA'da değişmez). Uygulama sürümü mağaza yayınlarını
 * kendiliğinden kapsar.
 */
export const QUERY_CACHE_SEMA = '1';

export function queryCacheBuster(sema: string, uygulamaSurumu: string | null | undefined): string {
  return `${sema}@${uygulamaSurumu ?? '0'}`;
}

type AppStateDurumu = string;
interface AppStateBenzeri {
  addEventListener: (tur: 'change', f: (durum: AppStateDurumu) => void) => { remove: () => void };
}
interface OdakYoneticisi {
  setEventListener: (f: (odak: (odakta?: boolean) => void) => () => void) => void;
}

/**
 * Natifte React Query'ye "uygulama öne geldi" bilgisini verir. Bağlanmazsa
 * `refetchOnWindowFocus` natifte HİÇ tetiklenmez: avukat uygulamayı arka
 * plandan döndüğünde (adliyeden çıkıp bildirimden girmek gibi) 60 sn'lik
 * staleTime geçmiş olsa da liste tazelenmezdi. Web'de ÇAĞRILMAZ (tarayıcının
 * görünürlük olayı zaten çalışıyor).
 */
export function odakYonetimineBagla(focusManager: OdakYoneticisi, appState: AppStateBenzeri): void {
  focusManager.setEventListener((odakAyarla) => {
    const abone = appState.addEventListener('change', (durum) => odakAyarla(durum === 'active'));
    return () => abone.remove();
  });
}
