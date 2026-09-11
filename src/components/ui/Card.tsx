import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadow, spacing } from '@/theme/theme';
import { etkilesim } from '@/theme/etkilesim';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  padded?: boolean;
}

export function Card({ children, onPress, style, elevated = true, padded = true }: CardProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const content = (uzerinde: boolean) => (
    <View
      style={[
        styles.base,
        elevated && shadow.card,
        padded && styles.padded,
        // Fareyle üzerine gelince kenarlık belirginleşir. Ölçüldü (2026-09-11):
        // uygulamadaki hiçbir tıklanabilir öge fareye YANIT VERMİYORDU —
        // hover öncesi ve sonrası hesaplanan stiller birebir aynıydı. Başarılı
        // web uygulamalarında satır/kart imleç üzerine gelince yanıt verir;
        // vermeyen arayüz "tıklanmaz" hissi bırakıyor. Telefonda hover yok,
        // orada bu dal hiç çalışmaz.
        uzerinde && styles.uzerinde,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable onPress={onPress} style={(durum) => [etkilesim(durum).pressed && styles.pressed]}>
      {(durum) => content(!!etkilesim(durum).hovered)}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  padded: {
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  uzerinde: {
    borderColor: colors.primaryMuted,
    backgroundColor: colors.surfaceHover,
  },
});
