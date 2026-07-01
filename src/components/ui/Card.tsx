import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  padded?: boolean;
}

export function Card({ children, onPress, style, elevated = true, padded = true }: CardProps) {
  const content = (
    <View style={[styles.base, elevated && shadow.card, padded && styles.padded, style]}>{children}</View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
