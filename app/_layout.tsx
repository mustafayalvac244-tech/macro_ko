import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { hydrateLanguage } from '@/i18n';
import { colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const hasHiddenSplash = useRef(false);

  useEffect(() => {
    const unsubscribe = initialize();
    hydrateLanguage().catch(() => {});
    registerForNotificationsAsync().catch(() => {});

    // Immersive mode: hide the Android system navigation bar while using the
    // app; a swipe from the bottom edge reveals it temporarily.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    return unsubscribe;
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitializing]);

  if (isInitializing) return null;

  const app = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
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
            <Stack.Screen name="change-password" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
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
