import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { useBuyukHarf } from '@/lib/buyukHarf';

interface BadgeProps {
  label: string;
  color: string;
  backgroundColor: string;
}

export function Badge({ label, color, backgroundColor }: BadgeProps) {
  // useTheme() yalnız ABONELİK için: tema değişince bu bileşen yeniden
  // çizilsin ve makeStyles güncel token'ları okusun.
  useTheme();
  const styles = makeStyles();
  // BÜYÜK HARF CSS'TEN DEĞİL JS'TEN — Türkçe "i" tuzağı.
  // Stilde `textTransform: 'uppercase'` vardı ve "Kritik" rozeti ekranda
  // **KRITIK** diye çıkıyordu (15.09.2026, dava listesi ekran görüntüsünde
  // görüldü). CSS dil bilmiyor; `toLocaleUpperCase('tr-TR')` biliyor.
  // Ayrıntı ve İngilizce tarafındaki ters hata: src/lib/buyukHarf.ts
  const buyut = useBuyukHarf();
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {buyut(label)}
      </Text>
    </View>
  );
}

// STİLLER RENDER ANINDA ÜRETİLİYOR — modül düzeyinde DEĞİL.
// Sebep (15.09.2026): yazı tipi/boyut/köşe artık temaya bağlı
// (bkz. src/theme/tokens.ts). Modül düzeyinde `StyleSheet.create` bir kez
// çalışıp DONAR: uygulama Klasik temayla açılıp Terminal'e geçilince bu dosya
// eski Manrope boyutlarında kalır ve ekranın geri kalanıyla uyumsuz görünür.
// Ölçüldü: 94 dosya zaten fabrika kullanıyordu, donuk kalan 3 dosyadan biri
// burasıydı.
const makeStyles = () => StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.small,
  },
});
