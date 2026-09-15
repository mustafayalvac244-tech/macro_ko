import {
  IBMPlexSans_400Regular, IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold, IBMPlexSans_700Bold, useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
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
  const [yazilarHazir, yaziHatasi] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
    IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
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
