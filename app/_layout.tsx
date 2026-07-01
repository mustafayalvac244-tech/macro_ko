import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const hasHiddenSplash = useRef(false);

  useEffect(() => {
    const unsubscribe = initialize();
    registerForNotificationsAsync().catch(() => {});
    return unsubscribe;
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitializing]);

  if (isInitializing) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen
              name="case-form"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="client-form"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="hearing-form"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="deadline-form"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="document-upload"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
