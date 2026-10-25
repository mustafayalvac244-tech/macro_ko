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
  // Yazı tipleri assets/fonts altında, paket olarak DEĞİL (24.10.2026):
  // @expo-google-fonts paketi eklemek package.json'ı değiştirir, OTA bekçisi
  // yayını durdurur ve herkes APK'yı yeniden kurmak zorunda kalırdı. TTF
  // dosyası sıradan bir varlık: OTA ile gider. 25.10.2026: Inter + JetBrains
  // Mono yerine tek aile Manrope (Vekil Pro'nun yazısı; gerekçe olculer.ts).
  // Eski IBM Plex paketleri package.json'da duruyor, kullanılmıyor; bir
  // sonraki sürüm yükseltmesinde kaldırılacak.
  const [yazilarHazir, yaziHatasi] = useFonts({
    Manrope_400Regular: require('../assets/fonts/Manrope_400Regular.ttf'),
    Manrope_500Medium: require('../assets/fonts/Manrope_500Medium.ttf'),
    Manrope_600SemiBold: require('../assets/fonts/Manrope_600SemiBold.ttf'),
    Manrope_700Bold: require('../assets/fonts/Manrope_700Bold.ttf'),
    Manrope_800ExtraBold: require('../assets/fonts/Manrope_800ExtraBold.ttf'),
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
  const { renkler, temaAdi } = useTema();
  return (
    <>
      {/* Başlık sayfa zemininde (25.10.2026): durum çubuğu simgeleri açık
          temada koyu, koyu temada açık. */}
      <StatusBar style={temaAdi === 'koyu' ? 'light' : 'dark'} />
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
