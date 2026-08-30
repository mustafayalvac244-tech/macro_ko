import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  useCreateCustomInstallments,
  useCreatePromise,
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
  const createInstallments = useCreateCustomInstallments();

  const [mode, setMode] = useState<'single' | 'installments'>('single');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('3');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // Taksit satırları elle düzenlenebilir (her ay eşit olmak zorunda değil).
  const [rows, setRows] = useState<{ amount: string; due: Date }[]>([]);

  const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
  const parsedCount = Number(count);
  const countValid = Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 36;

  const parseMoney = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

  // Toplam/adet/ilk vade değişince eşit bölünmüş bir taslak üretilir; kullanıcı
  // sonrasında her satırın tutarını tek tek değiştirebilir.
  useEffect(() => {
    if (mode !== 'installments' || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !countValid) {
      setRows([]);
      return;
    }
    const per = Math.floor((parsedAmount / parsedCount) * 100) / 100;
    const last = Math.round((parsedAmount - per * (parsedCount - 1)) * 100) / 100;
    setRows(
      Array.from({ length: parsedCount }, (_, i) => ({
        amount: String(i === parsedCount - 1 ? last : per),
        due: addMonths(dueDate, i),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, amount, count, dueDate]);

  const rowsSum = rows.reduce((s, r) => s + (parseMoney(r.amount) || 0), 0);

  const isSubmitting = createPromise.isPending || createInstallments.isPending;

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'installments') {
      if (!countValid) {
        setError(t('promise.countInvalid'));
        return;
      }
      if (rows.some((r) => !(parseMoney(r.amount) > 0))) {
        setError(t('promise.rowAmountInvalid'));
        return;
      }
    } else if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t('financeForm.amountRequired'));
      return;
    }
    try {
      if (mode === 'installments') {
        await createInstallments.mutateAsync({
          client_id: clientId!,
          clientName: clientName ?? '',
          rows: rows.map((r) => ({ amount: parseMoney(r.amount), due_date: format(r.due, 'yyyy-MM-dd') })),
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
            <DateTimePicker locale="tr-TR"
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

          {mode === 'installments' && rows.length > 0 && (
            <View style={styles.planBox}>
              <View style={styles.planHeadRow}>
                <Text style={styles.planTitle}>{t('promise.preview')}</Text>
                <Text style={styles.planSum}>{t('promise.sum')}: {formatMoney(rowsSum)}</Text>
              </View>
              {rows.map((row, i) => (
                <View key={i} style={styles.planRow}>
                  <Text style={styles.planSeq}>{t('promise.seqShort', { seq: i + 1 })}</Text>
                  <Text style={styles.planDate}>{formatDate(row.due.toISOString())}</Text>
                  <View style={styles.planAmountBox}>
                    <Text style={styles.planCurrency}>₺</Text>
                    <TextInput
                      style={styles.planInput}
                      value={row.amount}
                      onChangeText={(v) =>
                        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, amount: v } : r)))
                      }
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                </View>
              ))}
              <Text style={styles.planNote}>{t('promise.customNote')}</Text>
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
  planHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  planTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  planSum: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '800',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  planSeq: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    width: 62,
  },
  planDate: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  planAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    minWidth: 96,
  },
  planCurrency: {
    ...typography.caption,
    color: colors.textMuted,
  },
  planInput: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    padding: 0,
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
