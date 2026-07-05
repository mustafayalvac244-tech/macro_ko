import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { initials } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 44 }: AvatarProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size <= 32 ? radius.sm : radius.md },
      ]}
    >
      <Text style={[styles.label, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.primary,
    fontWeight: '700',
  },
});
