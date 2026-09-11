import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import * as Updates from 'expo-updates';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { asyncPersister, queryClient, QUERY_CACHE_MAX_AGE } from '@/lib/queryClient';
import { configurePurchases, identifyPurchaser, resetPurchaser } from '@/lib/purchases';
import { hydrateLanguage } from '@/i18n';
import { hydrateTheme } from '@/theme/themeStore';
import { useTheme } from '@/theme/useTheme';
import { hydrateLock } from '@/store/lockStore';
import { hydrateAdvanceAlerts } from '@/store/advanceAlertStore';
import { AppLock } from '@/components/AppLock';
import { UyariKatmani } from '@/components/ui/UyariKatmani';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LaunchIntro } from '@/components/LaunchIntro';
import { WebUyelikKapisi } from '@/components/WebUyelikKapisi';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Çevrimdışı dayanıklılık: sorgu önbelleği cihaza yazılır; avukat çekmeyen bir
// yerde (adliye vb.) uygulamayı açtığında son senkronize davalar/takvim boş ekran
// yerine okunur halde gelir. İstemci ve kalıcı yazıcı artık src/lib/queryClient
// içinde: çıkışta önbelleğin TEMİZLENEBİLMESİ için authStore'un da erişmesi
// gerekiyordu (bkz. oradaki açıklama).


export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const hasHiddenSplash = useRef(false);
  const { colors, statusBar } = useTheme();

  // Fontlar hazır OLANA KADAR native splash açık kalır (aşağıda). Açılış
  // animasyonu (LaunchIntro) markanın el yazısı fontuyla (Dancing Script)
  // "Vekil Pro" yazdığından, font yüklenmeden oynarsa Android'de o yazı BOŞ
  // render oluyordu ("sadece slogan görünüyor" hatası). Bu yüzden fontları
  // bekliyoruz — ama YALNIZCA fontları; oturum (yavaş olan) beklenmez.
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    DancingScript_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  // Fontlar 3 sn'de yüklenmezse yine de aç (donmuş splash'tan iyidir).
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontsTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontsTimedOut;

  useEffect(() => {
    const unsubscribe = initialize();
    hydrateLanguage().catch(() => {});
    hydrateTheme().catch(() => {});
    hydrateLock().catch(() => {});
    hydrateAdvanceAlerts().catch(() => {});
    registerForNotificationsAsync().catch(() => {});
    // Anahtar yoksa (RevenueCat henüz kurulmadıysa) veya web'deyse sessizce
    // atlar — bkz. src/lib/purchases.ts.
    configurePurchases();

    // Immersive mode: hide the Android system navigation bar while using the
    // app; a swipe from the bottom edge reveals it temporarily.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    // OTA: güncelleme varsa SADECE arka planda indir; ANINDA reload ETME.
    // Anında reloadAsync, açılış animasyonunun ortasında uygulamayı yeniden
    // başlatıp "2-3 kez açılıyor / animasyon bozuk" hissine yol açıyordu.
    // İndirilen güncelleme kullanıcının bir sonraki normal açılışında sorunsuz
    // devreye girer (Expo varsayılan davranışı).
    (async () => {
      try {
        if (__DEV__ || !Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch {
        // Ağ yoksa veya kontrol başarısız olursa mevcut sürümle devam edilir.
      }
    })();

    return unsubscribe;
  }, [initialize]);

  // RevenueCat kimliğini oturumla senkron tutar: giriş yapınca satın alma
  // geçmişi gerçek kullanıcıya bağlanır (bkz. src/lib/purchases.ts), çıkış
  // yapınca sıfırlanır — aksi hâlde bir sonraki kullanıcı öncekinin RevenueCat
  // kimliğini (ve dolayısıyla premium durumunu) devralabilirdi.
  //
  // logOut yalnız GERÇEK bir "önce girişliydi, şimdi çıktı" geçişinde çağrılır
  // — RevenueCat, hiç giriş yapılmamış (baştan anonim) bir kimlikte logOut()
  // çağrılırsa hata fırlatıyor; uygulama her açılışta (henüz oturum yokken)
  // gereksiz bir hata/uyarı üretmesin diye önceki değer izlenir.
  const userId = useAuthStore((s) => s.session?.user.id);
  const oncekiUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (userId) identifyPurchaser(userId);
    else if (oncekiUserId.current) resetPurchaser();
    oncekiUserId.current = userId;
  }, [userId]);

  // Native splash'ı, uygulama iskeleti ekrana İLK DÜŞTÜĞÜ AN kapat — fontları
  // BEKLEME. Böylece ilk resim, sadece JavaScript yüklenene kadar durur (diğer
  // hızlı uygulamalar gibi minimum süre), font/oturum yüklemesini beklemez.
  // Native splash = LaunchIntro'nun ilk karesiyle aynı (lacivert + logo);
  // animasyon o kareden devralır. Animasyonun ilk fazı yalnız LOGO'dur (font
  // gerekmez); "Vekil Pro" yazısı ~0.6 sn sonra belirir ve o ana kadar fontlar
  // yüklenmiş olur (yüklenmediyse yazı kısa süre sistem fontuyla çıkar, boş
  // KALMAZ, sonra el yazısına geçer).
  const hideSplash = () => {
    if (!hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  const app = (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={hideSplash}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncPersister, maxAge: QUERY_CACHE_MAX_AGE }}
        >
          <StatusBar style={statusBar} />
          <ErrorBoundary>
          {/* WEB SÜRÜMÜ YALNIZ ÜYELERE (ürün kararı). Natifte ve oturum
              yokken hiçbir şey yapmaz; yalnız tarayıcıda, giriş yapmış ve
              üye OLMAYAN kullanıcıya açıklama ekranı gösterir. Kapı burada,
              Stack'in DIŞINDA: üyelik ekranları kök seviyede (/ictihat,
              /ai-chat, /premium …) ve yalnız (app) düzenini sarmak onları
              açıkta bırakırdı. Bkz. src/components/WebUyelikKapisi.tsx. */}
          <WebUyelikKapisi>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="case-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="client-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="hearing-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="deadline-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="document-upload" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="premium" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="reminders" options={{ headerShown: false }} />
            <Stack.Screen name="feedback" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="reports" options={{ headerShown: false }} />
            <Stack.Screen name="finance" options={{ headerShown: false }} />
            <Stack.Screen name="finance-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="deadline-wizard" options={{ headerShown: false }} />
            <Stack.Screen name="calculators" options={{ headerShown: false }} />
            <Stack.Screen name="constitution" options={{ headerShown: false }} />
            <Stack.Screen name="laws" options={{ headerShown: false }} />
            <Stack.Screen name="law/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="daily-question" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="chat/index" options={{ headerShown: false }} />
            <Stack.Screen name="chat/office" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[peerId]" options={{ headerShown: false }} />
            <Stack.Screen name="jobs/index" options={{ headerShown: false }} />
            <Stack.Screen name="job-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="promise-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="enforcement-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="enforcement/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="document-viewer" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="hesap-sil" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="profile-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="privacy" options={{ headerShown: false }} />
            <Stack.Screen name="templates" options={{ headerShown: false }} />
            <Stack.Screen name="search" options={{ headerShown: false }} />
            <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
            <Stack.Screen name="ictihat" options={{ headerShown: false }} />
            <Stack.Screen name="aihm" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="contract" options={{ headerShown: false }} />
          </Stack>
          </WebUyelikKapisi>
          <AppLock />
          {/* Web'de uyarı/onay penceresi — react-native-web'in Alert'i boş bir
              fonksiyon olduğu için silme/çıkış onayları hiç açılmıyordu.
              Natifte hiçbir şey çizmez. */}
          <UyariKatmani />
          <LaunchIntro fontsReady={fontsReady} />
          </ErrorBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  return app;
}
