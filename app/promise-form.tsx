import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addMonths, format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  isMissingInstallmentColumns,
  isMissingPromiseTable,
  useCreatePromise,
  useCreatePromiseInstallments,
} from '@/hooks/usePaymentPromises';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';

export default function PromiseFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { clientId, clientName } = useLocalSearchParams<{ clientId: string; clientName?: string }>();
  const createPromise = useCreatePromise();
  const createInstallments = useCreatePromiseInstallments();

  const [mode, setMode] = useState<'single' | 'installments'>('single');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('3');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
  const parsedCount = Number(count);
  const countValid = Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 36;

  // Ödeme planı önizlemesi: eşit taksitler, yuvarlama farkı son taksitte.
  const plan = useMemo(() => {
    if (mode !== 'installments' || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !countValid) return [];
    const per = Math.floor((parsedAmount / parsedCount) * 100) / 100;
    const last = Math.round((parsedAmount - per * (parsedCount - 1)) * 100) / 100;
    return Array.from({ length: parsedCount }, (_, i) => ({
      seq: i + 1,
      amount: i === parsedCount - 1 ? last : per,
      due: addMonths(dueDate, i),
    }));
  }, [mode, parsedAmount, parsedCount, countValid, dueDate]);

  const isSubmitting = createPromise.isPending || createInstallments.isPending;

  const handleSubmit = async () => {
    setError(null);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t('financeForm.amountRequired'));
      return;
    }
    if (mode === 'installments' && !countValid) {
      setError(t('promise.countInvalid'));
      return;
    }
    try {
      if (mode === 'installments') {
        await createInstallments.mutateAsync({
          client_id: clientId!,
          clientName: clientName ?? '',
          total: parsedAmount,
          count: parsedCount,
          firstDue: dueDate,
          note: note.trim() || null,
        });
      } else {
        await createPromise.mutateAsync({
          client_id: clientId!,
          clientName: clientName ?? '',
          amount: parsedAmount,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          note: note.trim() || null,
        });
      }
      router.back();
    } catch (e) {
      setError(
        isMissingPromiseTable(e) || isMissingInstallmentColumns(e)
          ? t('promise.setupRequired')
          : t('financeForm.saveFailed')
      );
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('promise.newTitle')} subtitle={clientName} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hintBox}>
            <Ionicons name="notifications-outline" size={18} color={colors.info} />
            <Text style={styles.hintText}>{t('promise.hint')}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('promise.mode')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'single', label: t('promise.modeSingle') },
              { value: 'installments', label: t('promise.modeInstallments') },
            ]}
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
          />
          <View style={styles.spacer} />

          <Input
            label={mode === 'installments' ? t('promise.totalAmount') : t('finance.amount')}
            placeholder="10000"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            icon="cash-outline"
          />

          {mode === 'installments' && (
            <Input
              label={t('promise.count')}
              placeholder="3"
              value={count}
              onChangeText={setCount}
              keyboardType="number-pad"
              icon="layers-outline"
            />
          )}

          <Text style={styles.label}>{mode === 'installments' ? t('promise.firstDue') : t('promise.dueDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(dueDate.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              minimumDate={new Date()}
              onChange={(_e, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setDueDate(date);
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(false)} style={styles.pickerDone} />
          )}

          {mode === 'installments' && plan.length > 0 && (
            <View style={styles.planBox}>
              <Text style={styles.planTitle}>{t('promise.preview')}</Text>
              {plan.map((row) => (
                <View key={row.seq} style={styles.planRow}>
                  <Text style={styles.planSeq}>{t('promise.seqShort', { seq: row.seq })}</Text>
                  <Text style={styles.planDate}>{formatDate(row.due.toISOString())}</Text>
                  <Text style={styles.planAmount}>{formatMoney(row.amount)}</Text>
                </View>
              ))}
              <Text style={styles.planNote}>{t('promise.monthlyNote')}</Text>
            </View>
          )}

          <View style={styles.spacer} />
          <Input
            label={t('finance.note')}
            placeholder={t('promise.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            style={styles.textArea}
          />

          <Button
            label={t('promise.create')}
            onPress={handleSubmit}
            loading={isSubmitting}
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
  hintBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.infoSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
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
  planBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  planTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  planSeq: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    width: 74,
  },
  planDate: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  planAmount: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  planNote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 15,
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
