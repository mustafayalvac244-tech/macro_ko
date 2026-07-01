import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, spacing, typography } from '@/theme/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  onPress?: () => void;
}

export function StatCard({ label, value, icon, accentColor = colors.primary, onPress }: StatCardProps) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accentColor}1F` }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
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
