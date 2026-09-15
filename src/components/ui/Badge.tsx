import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { useBuyukHarf } from '@/lib/buyukHarf';

interface BadgeProps {
  label: string;
  color: string;
  backgroundColor: string;
}

export function Badge({ label, color, backgroundColor }: BadgeProps) {
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

const styles = StyleSheet.create({
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
