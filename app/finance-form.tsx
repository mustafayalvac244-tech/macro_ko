import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { isMissingFinanceTable, useCreateFinanceEntry } from '@/hooks/useFinance';
import { EXPENSE_CATEGORIES, FINANCE_CATEGORY_ICONS, INCOME_CATEGORIES } from '@/constants/finance';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';
import type { FinanceCategory, FinanceKind } from '@/types/database';

export default function FinanceFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const params = useLocalSearchParams<{ kind?: string }>();
  const createEntry = useCreateFinanceEntry();

  const [kind, setKind] = useState<FinanceKind>(params.kind === 'income' ? 'income' : 'expense');
  const [category, setCategory] = useState<FinanceCategory>(params.kind === 'income' ? 'fee' : 'rent');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleKindChange = (next: FinanceKind) => {
    setKind(next);
    setCategory(next === 'income' ? 'fee' : 'rent');
  };

  const handleSubmit = async () => {
    setError(null);
    const parsed = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('financeForm.amountRequired'));
      return;
    }
    try {
      await createEntry.mutateAsync({
        kind,
        category,
        title: title.trim() || t(`fcat.${category}` as const),
        amount: parsed,
        entry_date: format(entryDate, 'yyyy-MM-dd'),
        is_recurring: isRecurring,
        note: note.trim() || null,
      });
      router.back();
    } catch (e) {
      setError(isMissingFinanceTable(e) ? t('ofinance.setupRequired') : t('financeForm.saveFailed'));
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={kind === 'income' ? t('financeForm.newIncome') : t('financeForm.newExpense')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('financeForm.kind')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'expense', label: t('ofinance.expense') },
              { value: 'income', label: t('ofinance.income') },
            ]}
            value={kind}
            onChange={handleKindChange}
          />

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('financeForm.category')}</Text>
          <View style={styles.categoryGrid}>
            {categories.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Ionicons
                    name={FINANCE_CATEGORY_ICONS[c]}
                    size={15}
                    color={active ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {t(`fcat.${c}` as const)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.spacer} />
          <Input
            label={t('financeForm.entryTitle')}
            placeholder={kind === 'income' ? t('financeForm.titlePlaceholderIncome') : t('financeForm.titlePlaceholderExpense')}
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label={t('finance.amount')}
            placeholder={t('finance.amountPlaceholder')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            icon="cash-outline"
          />

          <Text style={styles.label}>{t('financeForm.date')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(entryDate.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={entryDate}
              mode="date"
              onChange={(_event, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setEntryDate(date);
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(false)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <View style={styles.recurringCard}>
            <View style={styles.recurringRow}>
              <View style={styles.recurringLeft}>
                <Ionicons name="repeat" size={18} color={colors.info} />
                <Text style={styles.recurringLabel}>{t('financeForm.recurring')}</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {isRecurring && <Text style={styles.recurringHint}>{t('financeForm.recurringHint')}</Text>}
          </View>

          <View style={styles.spacer} />
          <Input
            label={t('financeForm.note')}
            placeholder={t('financeForm.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            style={styles.textArea}
          />

          <Button
            label={t('financeForm.save')}
            onPress={handleSubmit}
            loading={createEntry.isPending}
            disabled={!amount.trim()}
            fullWidth
            size="lg"
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  dateButtonText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  pickerDone: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  recurringCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurringLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  recurringLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  recurringHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
