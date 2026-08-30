import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  const isDisabled = disabled || loading;
  const variantStyle = makeVariantStyles(colors)[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color as string} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={sizeStyle.iconSize} color={variantStyle.text.color as string} style={styles.icon} />}
          <Text style={[styles.label, sizeStyle.text, variantStyle.text]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeVariantStyles = (colors: ThemeColors) => ({
  primary: StyleSheet.create({
    container: { backgroundColor: colors.primary },
    text: { color: '#FFFFFF' },
  }),
  secondary: StyleSheet.create({
    container: { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.textPrimary },
  }),
  ghost: StyleSheet.create({
    container: { backgroundColor: 'transparent' },
    text: { color: colors.primary },
  }),
  danger: StyleSheet.create({
    container: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
    text: { color: colors.danger },
  }),
});

const sizeStyles = {
  sm: { container: { paddingVertical: 8, paddingHorizontal: spacing.md }, text: { fontSize: 13, fontWeight: '600' as const }, iconSize: 16 },
  md: { container: { paddingVertical: 13, paddingHorizontal: spacing.lg }, text: { fontSize: 15, fontWeight: '600' as const }, iconSize: 18 },
  lg: { container: { paddingVertical: 16, paddingHorizontal: spacing.xl }, text: { fontSize: 16, fontWeight: '700' as const }, iconSize: 20 },
};

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    ...typography.bodyMedium,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
