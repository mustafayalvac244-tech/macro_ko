import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { useT } from '@/i18n';
import type { ThemeColors } from '@/theme/palettes';

interface FABProps {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Ekran okuyucu adı; verilmezse genel "Ekle". */
  accessibilityLabel?: string;
}

export function FAB({ icon = 'add', onPress, accessibilityLabel }: FABProps) {
  const __t = useTheme();
  const t = useT();
  const styles = makeStyles(__t.colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('header.add')}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.fab, shadow.floating, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={26} color={__t.colors.textInverse} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
