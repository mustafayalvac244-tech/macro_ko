import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  onPress?: () => void;
}

export function StatCard({ label, value, icon, accentColor, onPress }: StatCardProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const accent = accentColor ?? colors.primary;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}1F` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
