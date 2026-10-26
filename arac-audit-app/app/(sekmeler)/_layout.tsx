// ALT SEKME ÇUBUĞU — Denetimler · Analiz · Ayarlar (25.10.2026).
//
// Ürün sahibi: "Lumiform'dan esinlen, güzel bir program." Lumiform'un
// masaüstünde ana bölümler (denetimler, aksiyonlar, analiz) kalıcı bir
// menüde duruyor; mobil uygulamalarda bunun karşılığı alt sekme çubuğu.
// Önceden Analiz sayaç kartındaki bir düğmeden, Ayarlar başlıktaki dişliden
// açılıyordu; ikisi de "gizli" kalıyordu.
//
// `expo-router/js-tabs`: expo-router'ın içinde gelen saf JavaScript sekme
// düzeni (React Navigation'ın bottom-tabs'i, paketin içine gömülü). Yerel
// kod YOK, package.json değişmedi — OTA ile gider. `unstable-native-tabs`
// yerel modül ister, o yüzden seçilmedi.
//
// Denetim ekranı, rapor, yeni denetim ve barkod sekmelerin ÜSTÜNDE açılır
// (kök Stack); orada sekme çubuğu görünmez, çalışma alanı daralmaz.

import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { S, Simge } from '@/bilesenler/simgeler';
import { useTema, yazi } from '@/tema';

const simge = (Ikon: Simge) => ({ color, size }: { color: unknown; size: number }) => (
  <Ikon size={size - 2} color={String(color)} strokeWidth={2} />
);

export default function SekmeDuzeni() {
  const { renkler } = useTema();
  const kenar = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: renkler.birincil,
        tabBarInactiveTintColor: renkler.metinSolgun,
        // Yükseklik hesapla verilir: varsayılan 49 px'e Manrope'un 16 px'lik
        // satırı sığmıyor, telefonda etiketin kutusu 9 px kalıyordu (ölçüm,
        // sekme-olc.mjs, 25.10.2026). Sekme öğesi: 5+5 iç boşluk + 28 simge
        // kutusu + 16 etiket = 54, +2 pay; çubuğun kendi boşluğu 4+4. Ev çubuğu payı
        // (kenar.bottom) ayrıca eklenir.
        tabBarStyle: {
          backgroundColor: renkler.bgYukseltilmis, borderTopColor: renkler.cizgiSolgun,
          height: 64 + kenar.bottom, paddingTop: 4, paddingBottom: 4 + kenar.bottom,
        },
        tabBarLabelStyle: { fontFamily: yazi.yariKalin, fontSize: 12, lineHeight: 16 },
        sceneStyle: { backgroundColor: renkler.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Denetimler', tabBarAccessibilityLabel: 'Denetimler', tabBarIcon: simge(S.denetimler) }}
      />
      <Tabs.Screen
        name="istatistik"
        options={{ title: 'Analiz', tabBarAccessibilityLabel: 'Analiz', tabBarIcon: simge(S.analiz) }}
      />
      <Tabs.Screen
        name="ayarlar"
        options={{ title: 'Ayarlar', tabBarAccessibilityLabel: 'Ayarlar', tabBarIcon: simge(S.ayarlar) }}
      />
    </Tabs>
  );
}
