import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { StripeProvider } from '@stripe/stripe-react-native';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { hydrateLanguage } from '@/i18n';
import { hydrateTheme } from '@/theme/themeStore';
import { useTheme } from '@/theme/useTheme';
import { hydrateLock } from '@/store/lockStore';
import { hydrateAdvanceAlerts } from '@/store/advanceAlertStore';
import { AppLock } from '@/components/AppLock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LaunchIntro } from '@/components/LaunchIntro';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Çevrimdışı dayanıklılık: sorgu önbelleği cihaza yazılır; avukat çekmeyen bir
// yerde (adliye vb.) uygulamayı açtığında son senkronize davalar/takvim boş ekran
// yerine okunur halde gelir. gcTime, önbelleğin 24 saat saklanmasını sağlar.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000, gcTime: 1000 * 60 * 60 * 24 },
  },
});

const asyncPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'VEKIL_QUERY_CACHE',
  throttleTime: 1000,
});

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

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

  // Native splash'ı, uygulama (fontlar hazır) iskeleti ekrana düşer düşmez kapat.
  // Native splash = LaunchIntro'nun ilk karesiyle BİREBİR aynı görüntü (lacivert +
  // logo) olduğundan geçiş görünmez; native splash kapanır kapanmaz doğrudan
  // animasyon oynar. Oturum (yavaş olan) beklenmez — o, ~2.5 sn'lik animasyon
  // boyunca arka planda çözülür ve doğru ekran perde kalkarken hazır olur.
  const hideSplash = () => {
    if (!hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  // Fontlar hazır değilken hiçbir şey render etme → native splash açık kalır
  // (statik bekleme karesi eklemez). Fontlar yerelde gömülü olduğundan bu çok
  // kısa sürer; ardından uygulama + intro fontlar HAZIR halde açılır.
  if (!fontsReady) return null;

  const app = (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={hideSplash}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncPersister, maxAge: 1000 * 60 * 60 * 24 }}
        >
          <StatusBar style={statusBar} />
          <ErrorBoundary>
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
            <Stack.Screen name="profile-form" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="privacy" options={{ headerShown: false }} />
            <Stack.Screen name="templates" options={{ headerShown: false }} />
            <Stack.Screen name="search" options={{ headerShown: false }} />
            <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
            <Stack.Screen name="ictihat" options={{ headerShown: false }} />
          </Stack>
          <AppLock />
          <LaunchIntro />
          </ErrorBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes('your-publishable-key')) {
    return app;
  }

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.macroko.legal">
      {app}
    </StripeProvider>
  );
}
