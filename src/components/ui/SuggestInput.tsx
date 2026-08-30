import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInputProps, View } from 'react-native';
import { Input } from './Input';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface SuggestInputProps extends TextInputProps {
  label?: string;
  suggestions: string[];
}

/**
 * Free-text input with tappable suggestion chips underneath.
 * Tapping a chip fills the field; typing stays fully manual.
 */
export function SuggestInput({ label, suggestions, value, onChangeText, ...rest }: SuggestInputProps) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.container}>
      <Input label={label} value={value} onChangeText={onChangeText} containerStyle={styles.input} {...rest} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {suggestions.map((suggestion) => {
          const active = value === suggestion;
          return (
            <Pressable
              key={suggestion}
              onPress={() => onChangeText?.(active ? '' : suggestion)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{suggestion}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.xs,
  },
  chips: {
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.primary,
  },
});
