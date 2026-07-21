import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  isMissingFinanceTable,
  useDeleteFinanceEntry,
  useFinanceEntries,
  useUpdateFinanceEntry,
} from '@/hooks/useFinance';
import { useAllPayments } from '@/hooks/usePayments';
import { FINANCE_CATEGORY_ICONS } from '@/constants/finance';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney } from '@/utils/format';
import type { FinanceEntry } from '@/types/database';

/** Parse a Postgres `date` string as local midnight (plain new Date() would be UTC). */
function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export default function FinanceScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const entries = useFinanceEntries();
  const payments = useAllPayments();
  const deleteEntry = useDeleteFinanceEntry();
  const updateEntry = useUpdateFinanceEntry();

  const monthStart = month;
  const monthEnd = useMemo(() => endOfMonth(month), [month]);
  const locale = lang === 'tr' ? trLocale : enUS;

  const needsSetup = !!entries.error && isMissingFinanceTable(entries.error);

  const { recurring, oneOff, casePaymentsTotal, casePaymentsCount, incomeTotal, expenseTotal } = useMemo(() => {
    const activeInMonth = (e: FinanceEntry): boolean => {
      if (e.is_recurring) {
        if (startOfMonth(localDate(e.entry_date)) > monthEnd) return false;
        if (e.recurring_until && endOfMonth(localDate(e.recurring_until)) < monthStart) return false;
        return true;
      }
      const d = localDate(e.entry_date);
      return d >= monthStart && d <= monthEnd;
    };

    const inMonth = (entries.data ?? []).filter(activeInMonth);
    const recurringItems = inMonth.filter((e) => e.is_recurring);
    const oneOffItems = inMonth
      .filter((e) => !e.is_recurring)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

    let paymentsTotal = 0;
    let paymentsCount = 0;
    payments.data?.forEach((p) => {
      const d = new Date(p.paid_at);
      if (d >= monthStart && d <= monthEnd) {
        paymentsTotal += Number(p.amount);
        paymentsCount += 1;
      }
    });

    let income = paymentsTotal;
    let expense = 0;
    inMonth.forEach((e) => {
      if (e.kind === 'income') income += Number(e.amount);
      else expense += Number(e.amount);
    });

    return {
      recurring: recurringItems,
      oneOff: oneOffItems,
      casePaymentsTotal: paymentsTotal,
      casePaymentsCount: paymentsCount,
      incomeTotal: income,
      expenseTotal: expense,
    };
  }, [entries.data, payments.data, monthStart, monthEnd]);

  const net = incomeTotal - expenseTotal;

  // Alıcı geri bildirimi: kaleme basınca doğrudan "sil" çıkıyordu; artık önce
  // Düzenle / Sil seçtiriyor (tekrarlıysa "aydan sonra durdur" da var).
  const openEditor = (entry: FinanceEntry) => {
    const q = new URLSearchParams({
      id: entry.id,
      kind: entry.kind,
      category: entry.category,
      title: entry.title ?? '',
      amount: String(entry.amount ?? ''),
      entry_date: entry.entry_date,
      is_recurring: entry.is_recurring ? '1' : '0',
      note: entry.note ?? '',
    }).toString();
    router.push(`/finance-form?${q}` as Parameters<typeof router.push>[0]);
  };

  const handleEntryPress = (entry: FinanceEntry) => {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.edit'), onPress: () => openEditor(entry) },
    ];
    if (entry.is_recurring) {
      buttons.push({
        text: t('ofinance.stopAfterMonth'),
        onPress: () => updateEntry.mutate({ id: entry.id, recurring_until: format(monthEnd, 'yyyy-MM-dd') }),
      });
      buttons.push({ text: t('ofinance.deleteAll'), style: 'destructive', onPress: () => deleteEntry.mutate(entry.id) });
      Alert.alert(t('ofinance.entryActionsTitle'), t('ofinance.recurringDeleteMsg'), buttons);
    } else {
      buttons.push({ text: t('common.delete'), style: 'destructive', onPress: () => deleteEntry.mutate(entry.id) });
      Alert.alert(t('ofinance.entryActionsTitle'), entry.title, buttons);
    }
  };

  const renderEntry = (entry: FinanceEntry) => {
    const isIncome = entry.kind === 'income';
    const amountColor = isIncome ? colors.success : colors.danger;
    const stopped = !!entry.recurring_until;
    return (
      <Pressable key={entry.id} style={styles.entryRow} onPress={() => handleEntryPress(entry)}>
        <View style={[styles.entryIcon, { backgroundColor: `${amountColor}14` }]}>
          <Ionicons name={FINANCE_CATEGORY_ICONS[entry.category] ?? 'ellipse-outline'} size={18} color={amountColor} />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <View style={styles.entryMetaRow}>
            <Text style={styles.entryMeta}>{t(`fcat.${entry.category}` as const)}</Text>
            {entry.is_recurring && (
              <View style={[styles.recurringTag, stopped && { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="repeat" size={10} color={stopped ? colors.textMuted : colors.info} />
                <Text style={[styles.recurringTagText, { color: stopped ? colors.textMuted : colors.info }]}>
                  {stopped
                    ? `${t('ofinance.stopped')} · ${format(endOfMonth(localDate(entry.recurring_until!)), 'MMM yyyy', { locale })}`
                    : t('ofinance.recurringTag')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.entryAmount, { color: amountColor }]} numberOfLines={1}>
          {isIncome ? '+' : '−'}
          {formatMoney(Number(entry.amount))}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={t('ofinance.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {needsSetup && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{t('ofinance.setupRequired')}</Text>
          </View>
        )}

        <View style={styles.monthNav}>
          <Pressable style={styles.monthArrow} onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthLabel}>{format(month, 'LLLL yyyy', { locale })}</Text>
          <Pressable style={styles.monthArrow} onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label={t('ofinance.income')} value={formatMoney(incomeTotal)} color={colors.success} />
          <SummaryTile label={t('ofinance.expense')} value={formatMoney(expenseTotal)} color={colors.danger} />
          <SummaryTile
            label={t('ofinance.net')}
            value={`${net < 0 ? '−' : ''}${formatMoney(Math.abs(net))}`}
            color={net < 0 ? colors.danger : colors.primary}
          />
        </View>

        <View style={styles.addRow}>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.success }]}
            onPress={() => router.push('/finance-form?kind=income' as Parameters<typeof router.push>[0])}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>{t('ofinance.addIncome')}</Text>
          </Pressable>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.danger }]}
            onPress={() => router.push('/finance-form?kind=expense' as Parameters<typeof router.push>[0])}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>{t('ofinance.addExpense')}</Text>
          </Pressable>
        </View>

        {recurring.length > 0 && (
          <>
            <SectionHeader title={t('ofinance.recurringSection')} />
            <Card style={styles.listCard}>
              {recurring.map((entry, index) => (
                <View key={entry.id} style={index > 0 ? styles.divider : undefined}>
                  {renderEntry(entry)}
                </View>
              ))}
            </Card>
          </>
        )}

        <SectionHeader title={t('ofinance.monthEntries')} />
        <Card style={styles.listCard}>
          {casePaymentsTotal > 0 && (
            <View style={styles.entryRow}>
              <View style={[styles.entryIcon, { backgroundColor: `${colors.gold}1A` }]}>
                <Ionicons name="briefcase-outline" size={18} color={colors.gold} />
              </View>
              <View style={styles.entryBody}>
                <Text style={styles.entryTitle}>{t('ofinance.casePayments', { n: casePaymentsCount })}</Text>
                <Text style={styles.entryMeta}>{t('finance.payments')}</Text>
              </View>
              <Text style={[styles.entryAmount, { color: colors.success }]}>+{formatMoney(casePaymentsTotal)}</Text>
            </View>
          )}
          {oneOff.length > 0 ? (
            oneOff.map((entry, index) => (
              <View key={entry.id} style={index > 0 || casePaymentsTotal > 0 ? styles.divider : undefined}>
                {renderEntry(entry)}
              </View>
            ))
          ) : casePaymentsTotal === 0 ? (
            <EmptyState icon="wallet-outline" title={t('ofinance.emptyMonth')} description={t('ofinance.emptyMonthDesc')} />
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={[styles.summaryTile, { backgroundColor: `${color}12`, borderColor: `${color}33` }]}>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    ...typography.h2,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.small,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 11,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listCard: {
    marginBottom: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  entryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBody: {
    flex: 1,
  },
  entryTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  entryMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  recurringTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.infoSoft,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  recurringTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  entryAmount: {
    ...typography.bodyMedium,
    fontWeight: '800',
  },
});
