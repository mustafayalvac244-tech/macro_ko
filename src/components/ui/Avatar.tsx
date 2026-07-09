import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { initials } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: number;
  /** Optional photo URL; falls back to initials while empty/loading. */
  uri?: string | null;
  /** Premium members get a gold ring + diamond badge. */
  premium?: boolean;
}

export function Avatar({ name, size = 44, uri, premium }: AvatarProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  const borderRadius = size <= 32 ? radius.sm : radius.md;

  const inner = (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.label, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      {uri ? <Image source={{ uri }} style={[StyleSheet.absoluteFill, { borderRadius }]} resizeMode="cover" /> : null}
    </View>
  );

  if (!premium) return inner;

  // Gold ring is a padded wrapper; badge sits on the bottom-right corner.
  const ringPad = Math.max(2, Math.round(size * 0.06));
  const badgeSize = Math.max(14, Math.round(size * 0.34));
  return (
    <View>
      <View
        style={[
          styles.ring,
          { padding: ringPad, borderRadius: borderRadius + ringPad },
        ]}
      >
        {inner}
      </View>
      <View
        style={[
          styles.badge,
          { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, borderColor: colors.bg },
        ]}
      >
        <Ionicons name="diamond" size={badgeSize * 0.56} color="#FFFFFF" />
      </View>
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
  ring: {
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
