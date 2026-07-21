import { useEffect, useRef } from 'react';
import { Image, Platform, View } from 'react-native';
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
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const hasHiddenSplash = useRef(false);
  const { colors, statusBar } = useTheme();

  // Uygulama fontları — yüklenene kadar splash açık kalır; yükleme hata verirse
  // sistem fontuyla devam edilir (fontError durumunda da ekran açılır).
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
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    const unsubscribe = initialize();
    hydrateLanguage().catch(() => {});
    hydrateTheme().catch(() => {});
    hydrateLock().catch(() => {});
    registerForNotificationsAsync().catch(() => {});

    // Immersive mode: hide the Android system navigation bar while using the
    // app; a swipe from the bottom edge reveals it temporarily.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    // OTA: güncelleme varsa açılışta indirip hemen uygula — kullanıcı ikinci
    // açılışı beklemek zorunda kalmasın (TestFlight/production).
    (async () => {
      try {
        if (__DEV__ || !Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          // Yeniden başlatmada giriş animasyonu TEKRAR oynamasın (çift açılış hissi).
          await AsyncStorage.setItem('VEKIL_SKIP_INTRO_ONCE', '1').catch(() => {});
          await Updates.reloadAsync();
        }
      } catch {
        // Ağ yoksa veya kontrol başarısız olursa mevcut sürümle devam edilir.
      }
    })();

    return unsubscribe;
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && fontsReady && !hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitializing, fontsReady]);

  if (isInitializing || !fontsReady) {
    // Gömülü splash ekranda oyalanmasın: ilk karede indirilir; yükleme bitene
    // kadar gömülü kareyle BİREBİR AYNI görüntü (lacivert + 240dp logo)
    // gösterilir — göz kesinti fark etmez, intro bunun üstünden akar.
    return (
      <View
        style={{ flex: 1, backgroundColor: '#0B1830', alignItems: 'center', justifyContent: 'center' }}
        onLayout={() => {
          if (!hasHiddenSplash.current) {
            hasHiddenSplash.current = true;
            SplashScreen.hideAsync().catch(() => {});
          }
        }}
      >
        <Image source={require('../assets/splash-icon.png')} style={{ width: 240, height: 240 }} />
      </View>
    );
  }

  const app = (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
