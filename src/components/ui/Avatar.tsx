import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { radius } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { initials } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: number;
  /** Optional photo URL; falls back to initials while empty/loading. */
  uri?: string | null;
}

export function Avatar({ name, size = 44, uri }: AvatarProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const borderRadius = size <= 32 ? radius.sm : radius.md;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.label, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      {uri ? <Image source={{ uri }} style={[StyleSheet.absoluteFill, { borderRadius }]} resizeMode="cover" /> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    color: colors.primary,
    fontWeight: '700',
  },
});
