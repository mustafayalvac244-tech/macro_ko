import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

/**
 * ÇÖKMEYİ KAYDET — 16.09.2026, gerçek bir olaydan doğdu.
 *
 * Ürün sahibi bir iPhone'da "Vekil Pro Çöktü" ekran görüntüsü gönderdi:
 * güncelleme sonrası çökmüş, Android'de hiç çökmemiş. Çökmeyi araştırırken
 * asıl arıza çıktı: `ErrorBoundary.componentDidCatch` yalnız `console.error`
 * yazıyordu ve gerçek bir cihazda o HİÇBİR YERE gitmiyor. Yani uygulama
 * çöküyor ve arkasında okuyabileceğimiz tek satır bırakmıyordu.
 *
 * Bu dosya çökmeyi ÖNLEMEZ, GÖRÜNÜR yapar. Bir sonraki çökmede ürün
 * sahibinden ekran görüntüsü ve Ayarlar'dan kayıt çıkarmasını istemek yerine
 * tek bir SQL sorgusu yetecek.
 */

/** Sütun sınırları — göçle (0143) aynı olmalı. */
const MESAJ_SINIR = 500;
const YIGIN_SINIR = 4000;

export type HataKaynagi = 'render' | 'effect' | 'global' | 'promise';

/**
 * ASLA FIRLATMAZ, ASLA BEKLETMEZ.
 *
 * Bir hata kaydedicinin kendisinin hata fırlatması, teşhis etmeye çalıştığı
 * çökmenin üstüne ikinci bir çökme koyar ve ilkini tamamen gizler. Bu yüzden
 * her şey try/catch içinde ve çağıran `await` etmek zorunda değil.
 */
export function hataKaydet(
  hata: unknown,
  kaynak: HataKaynagi,
  ekran?: string,
): void {
  void (async () => {
    try {
      const e = hata as { message?: string; stack?: string } | null;
      const mesaj = String(e?.message ?? hata ?? 'bilinmeyen hata').slice(0, MESAJ_SINIR);
      const yigin = e?.stack ? String(e.stack).slice(0, YIGIN_SINIR) : null;

      // owner_id NULL olabilir: en değerli çökme, kullanıcı henüz giriş
      // yapmamışken açılışta olandır (bkz. göç 0143).
      let uid: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        uid = data?.user?.id ?? null;
      } catch {
        // Oturum okunamıyorsa kayıt yine gitsin — anonim bir çökme, hiç
        // kayıt olmamasından çok daha iyidir.
      }

      await supabase.from('istemci_hata').insert({
        owner_id: uid,
        mesaj,
        yigin,
        kaynak,
        ekran: ekran ?? null,
        platform: Platform.OS,
        uygulama_surumu: Constants.expoConfig?.version ?? null,
        // "Güncelleme sonrası çöktü" iddiasını DOĞRULAYAN ya da ÇÜRÜTEN iki
        // alan. Bunlar olmadan o cümle bir rivayet, bunlarla bir ölçüm.
        calisma_surumu: Updates.runtimeVersion ?? null,
        guncelleme_id: Updates.updateId ?? null,
      });
    } catch {
      // Sessiz. Gerekçe yukarıda.
    }
  })();
}

/**
 * MODÜL SEVİYESİ VE EFFECT KÖR NOKTALARINI KAPATIR.
 *
 * ÖLÇÜLDÜ (16.09.2026, kod okunarak): `ErrorBoundary` yalnız SARDIĞI React
 * ağacındaki render hatalarını yakalıyor. Üç şey dışarıda kalıyordu:
 *   1) Modül seviyesinde koşan kod — örn. themeStore.ts:19'daki
 *      `temaTokenlariniUygula(ACILIS_TEMASI)`. Orada atılan hata React
 *      başlamadan önce olur; hiçbir sınır göremez.
 *   2) Effect içindeki hatalar — src/lib/purchases.ts:52'de zaten yazılı.
 *   3) Yakalanmamış promise reddi.
 * Bu üçü, "açılışta çöküyor" tipindeki en kötü çökmelerin tam olarak
 * geldiği yerler.
 */
export function kuresellHataYakalayiciyiKur(): void {
  try {
    // React Native'in global hata kancası. `isFatal` true ise uygulama zaten
    // ölüyor; kaydı yine de göndermeye çalışıyoruz — çoğu zaman istek
    // uygulamadan önce çıkıyor, çıkmazsa bir sonraki açılışta da kaybımız yok.
    const g = (globalThis as { ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, f?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, f?: boolean) => void) => void;
    } }).ErrorUtils;

    const onceki = g?.getGlobalHandler?.();
    g?.setGlobalHandler?.((e: unknown, fatal?: boolean) => {
      hataKaydet(e, 'global');
      // ÖNCEKİ KANCAYI MUTLAKA ÇAĞIR. Çağırmazsak kırmızı ekran/çökme
      // davranışını biz yutmuş oluruz ve hata SESSİZCE kaybolur — tam da
      // düzeltmeye çalıştığımız şey.
      onceki?.(e, fatal);
    });
  } catch {
    // Kancayı kuramazsak uygulama normal çalışmaya devam etsin.
  }
}
