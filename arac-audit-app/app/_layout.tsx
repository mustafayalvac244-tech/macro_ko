import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TemaSaglayici, useTema } from '@/tema';
import { useKatalog } from '@/veri/katalogDeposu';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash zaten gizlenmişse sorun değil.
});

export default function KokDuzen() {
  // Yazı tipleri assets/fonts altında, paket olarak DEĞİL (24.10.2026, ürün
  // sahibi: "yazı tipini güzelleştir"): @expo-google-fonts paketi eklemek
  // package.json'ı değiştirir, OTA bekçisi yayını durdurur ve herkes APK'yı
  // yeniden kurmak zorunda kalırdı. TTF dosyası sıradan bir varlık: OTA ile
  // gider. Eski IBM Plex paketleri package.json'da duruyor, kullanılmıyor;
  // bir sonraki sürüm yükseltmesinde kaldırılacak.
  const [yazilarHazir, yaziHatasi] = useFonts({
    Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
    JetBrainsMono_500Medium: require('../assets/fonts/JetBrainsMono_500Medium.ttf'),
    JetBrainsMono_600SemiBold: require('../assets/fonts/JetBrainsMono_600SemiBold.ttf'),
  });

  useEffect(() => {
    // Yazı tipi yüklenemezse de aç: sistem yazısıyla çalışmak, boş ekranda
    // beklemekten iyidir. Denetçi vardiyada; uygulama açılmak zorunda.
    if (yazilarHazir || yaziHatasi) SplashScreen.hideAsync().catch(() => {});
  }, [yazilarHazir, yaziHatasi]);

  // Ekibin eklediği hata tiplerini kataloğa bağla. Açılışı BEKLETMEZ: hata
  // kaydı ekranı bu iş bitmeden açılırsa yalnız yerleşik tipler görünür,
  // liste yüklenince kendiliğinden tazelenir.
  useEffect(() => { useKatalog.getState().yukle(); }, []);

  if (!yazilarHazir && !yaziHatasi) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TemaSaglayici>
          <Govde />
        </TemaSaglayici>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Govde() {
  const { renkler } = useTema();
  return (
    <>
      {/* Uygulama çubuğu iki temada da koyu (paletler.ts → cubuk); durum
          çubuğu simgeleri de o yüzden iki temada da açık renk. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: renkler.bg },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
