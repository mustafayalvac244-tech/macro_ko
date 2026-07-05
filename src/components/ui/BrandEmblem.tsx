import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '@/theme/theme';

interface BrandEmblemProps {
  size?: number;
}

/**
 * Premium, fully vector brand emblem (crisp at any size): a navy gradient
 * rounded square with a soft gold glow ring and the scales-of-justice icon.
 */
export function BrandEmblem({ size = 92 }: BrandEmblemProps) {
  const radius = size * 0.28;
  return (
    <View style={[styles.glowWrap, { width: size + 24, height: size + 24 }]}>
      <View
        style={[
          styles.glow,
          { width: size + 24, height: size + 24, borderRadius: (size + 24) / 2 },
        ]}
      />
      <LinearGradient
        colors={['#22335C', '#0B1324']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.emblem, shadow.floating, { width: size, height: size, borderRadius: radius }]}
      >
        <View style={[styles.ring, { borderRadius: radius - 4, width: size - 12, height: size - 12 }]}>
          <Ionicons name="scale-outline" size={size * 0.46} color={colors.gold} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  glowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(201, 162, 75, 0.18)',
  },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 75, 0.45)',
  },
});
