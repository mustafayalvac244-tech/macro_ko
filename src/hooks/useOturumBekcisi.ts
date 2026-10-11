import { useEffect, useRef } from 'react';
import { router, useGlobalSearchParams, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  bekciKarari,
  girisHedefiniBirak,
  girisHedefiniSakla,
  girisHedefiYolu,
} from '@/lib/girisYonlendirme';

/**
 * KÖK EKRANLAR İÇİN OTURUM BEKÇİSİ + ÇIKIŞTA YIĞIN TEMİZLİĞİ (AJAN 28).
 *
 * Karar mantığı saf ve testli: src/lib/girisYonlendirme.ts (bekciKarari).
 * Bu kanca yalnız o kararı expo-router çağrılarına çevirir. Köke yalnız BİR
 * kez (app/_layout.tsx) takılır.
 *
 *  - girise-at: oturumsuz kök ekran (ör. /ai-chat) → adres saklanır, girişe
 *    gidilir; girişten sonra (auth)/_layout saklanan adrese yönlendirir.
 *  - cikis: oturum vardı, şimdi yok → yığın temizlenir (geri tuşu eski
 *    ekranlara götürmesin), girişe gidilir, bekleyen hedef atılır (başka bir
 *    hesapla girişte önceki hesabın ekranı açılmasın).
 *  - hedefi-birak: oturumlu ve uygulama içinde → bekleyen hedef bayatladı.
 *
 * Cihazda/tarayıcıda DENENMEDİ (bu ortamda uygulama çalıştırılamadı).
 */
export function useOturumBekcisi(): void {
  const oturumVar = useAuthStore((s) => !!s.session);
  const baslatiliyor = useAuthStore((s) => s.isInitializing);
  const segmentler = useSegments() as string[];
  const yol = usePathname();
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>;
  // Gezinti kapsayıcısı hazır olmadan router çağrısı atılamaz.
  const hazir = !!useRootNavigationState()?.key;
  const oturumGoruldu = useRef(false);

  useEffect(() => {
    if (!hazir) return;
    const karar = bekciKarari({ baslatiliyor, oturumVar, oturumGoruldu: oturumGoruldu.current, segmentler });
    if (oturumVar) oturumGoruldu.current = true;

    if (karar === 'girise-at') {
      girisHedefiniSakla(girisHedefiYolu(yol, params));
      router.replace('/(auth)/login');
    } else if (karar === 'cikis') {
      oturumGoruldu.current = false;
      girisHedefiniBirak();
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // yığın zaten tek ekran
      }
      router.replace('/(auth)/login');
    } else if (karar === 'hedefi-birak') {
      girisHedefiniBirak();
    }
    // params bilerek bağımlılık dışı: nesne her render yeni kimlik alır ve
    // yönlendirme tekrar tekrar denenirdi; yol değişince zaten yeniden çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazir, baslatiliyor, oturumVar, yol, segmentler.join('/')]);
}
