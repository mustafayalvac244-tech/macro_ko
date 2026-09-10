import React from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { radius, shadow, spacing } from '@/theme/theme';
import { genisEkranMi } from '@/theme/duzen';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface WebKartProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * GENİŞ EKRANDA İÇERİĞİ KART YÜZEYİNE OTURTUR (yalnız web).
 *
 * NEDEN: telefonda giriş formu ekranın tamamıdır, arkasında ayrı bir yüzey
 * olmasına gerek yoktur. Masaüstünde ise aynı form, geniş boş bir zeminin
 * ortasında serbestçe duran birkaç kutucuğa dönüşüyor — nereye ait olduğu
 * belli olmuyor. Masaüstü uygulamalarının giriş ekranı bu yüzden hep bir
 * KART üstündedir: form bir nesne hâline gelir, zemin arka plan olur.
 *
 * NATİFTE HİÇBİR ŞEY YAPMAZ: genisEkranMi() Platform.OS'a bakar, telefonda
 * children olduğu gibi döner — fazladan View bile eklenmez.
 */
export function WebKart({ children, style }: WebKartProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const { width } = useWindowDimensions();

  if (!genisEkranMi(width)) return <>{children}</>;

  return <View style={[styles.kart, shadow.card, style]}>{children}</View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  kart: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
