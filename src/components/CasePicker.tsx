import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCases } from '@/hooks/useCases';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface CasePickerProps {
  value: string | null;
  onChange: (caseId: string) => void;
}

/**
 * Açık dosyalar arasından seçim yapan açılır alan. Duruşma/görev formları
 * takvimden dosya parametresi olmadan açıldığında kullanılır.
 */
export function CasePicker({ value, onChange }: CasePickerProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [open, setOpen] = useState(false);
  const { data: cases } = useCases({ status: 'open' });
  const selected = useMemo(() => cases?.find((c) => c.id === value) ?? null, [cases, value]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('casePicker.label')}</Text>
      <Pressable style={[styles.field, !selected && styles.fieldEmpty]} onPress={() => setOpen((o) => !o)}>
        <Ionicons name="folder-open-outline" size={18} color={selected ? colors.primary : colors.textMuted} />
        <Text style={[styles.fieldText, !selected && styles.fieldPlaceholder]} numberOfLines={1}>
          {selected ? selected.title : t('casePicker.placeholder')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {open &&
        ((cases ?? []).length === 0 ? (
          <Text style={styles.emptyText}>{t('casePicker.empty')}</Text>
        ) : (
          <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {(cases ?? []).map((c) => (
              <Pressable
                key={c.id}
                style={styles.item}
                onPress={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                  {!!c.case_number && <Text style={styles.itemSub}>{c.case_number}</Text>}
                </View>
                {c.id === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  fieldEmpty: {
    borderStyle: 'dashed',
  },
  fieldText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  fieldPlaceholder: {
    color: colors.textMuted,
  },
  list: {
    maxHeight: 220,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  itemSub: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
