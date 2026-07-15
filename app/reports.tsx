import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, subMonths } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCases } from '@/hooks/useCases';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useAllPayments, usePaidInstallmentsTotal } from '@/hooks/usePayments';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney } from '@/utils/format';
import type { CaseStatus } from '@/types/database';

const STATUS_ORDER: CaseStatus[] = ['active', 'pending', 'on_hold', 'won', 'lost', 'closed'];

export default function ReportsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const caseStatusColors = __t.caseStatusColors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const cases = useCases();
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const payments = useAllPayments();
  const paidInstTotal = usePaidInstallmentsTotal();

  const statusCounts = useMemo(() => {
    const counts = new Map<CaseStatus, number>();
    cases.data?.forEach((c) => counts.set(c.status, (counts.get(c.status) ?? 0) + 1));
    return counts;
  }, [cases.data]);

  const monthly = useMemo(() => {
    const locale = lang === 'tr' ? trLocale : enUS;
    const buckets: { label: string; key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = subMonths(new Date(), i);
      buckets.push({ label: format(d, 'MMM', { locale }), key: format(d, 'yyyy-MM'), count: 0 });
    }
    hearings.data?.forEach((h) => {
      const key = format(new Date(h.scheduled_at), 'yyyy-MM');
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [hearings.data, lang]);

  const deadlineStats = useMemo(() => {
    let completed = 0;
    let open = 0;
    let overdue = 0;
    const now = Date.now();
    deadlines.data?.forEach((d) => {
      if (d.is_completed) completed += 1;
      else if (new Date(d.due_at).getTime() < now) overdue += 1;
      else open += 1;
    });
    return { completed, open, overdue };
  }, [deadlines.data]);

  const finance = useMemo(() => {
    const totalFee = (cases.data ?? []).reduce((sum, c) => sum + (c.fee_amount != null ? Number(c.fee_amount) : 0), 0);
    // Tahsilat = ödemeler + ödenmiş taksitler (case detay ile tutarlı).
    const paymentsSum = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalCollected = paymentsSum + (paidInstTotal.data ?? 0);
    return { totalFee, totalCollected };
  }, [cases.data, payments.data, paidInstTotal.data]);

  const totalCases = cases.data?.length ?? 0;
  const maxStatus = Math.max(1, ...Array.from(statusCounts.values()));
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.count));
  const hasData = totalCases > 0 || (hearings.data?.length ?? 0) > 0;

  return (
    <Screen>
      <ScreenHeader title={t('reports.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {!hasData ? (
          <Card>
            <EmptyState icon="stats-chart-outline" title={t('reports.empty')} description={t('reports.emptyDesc')} />
          </Card>
        ) : (
          <>
            <SectionHeader title={`${t('reports.casesByStatus')} · ${t('reports.totalCases')}: ${totalCases}`} />
            <Card style={styles.chartCard}>
              {STATUS_ORDER.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((status) => {
                const count = statusCounts.get(status)!;
                const palette = caseStatusColors[status]!;
                return (
                  <View key={status} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {t(`status.${status}` as const)}
                    </Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(count / maxStatus) * 100}%`, backgroundColor: palette.fg }]} />
                    </View>
                    <Text style={styles.barCount}>{count}</Text>
                  </View>
                );
              })}
            </Card>

            <SectionHeader title={t('reports.hearingsPerMonth')} />
            <Card style={styles.chartCard}>
              <View style={styles.columns}>
                {monthly.map((m) => (
                  <View key={m.key} style={styles.column}>
                    <Text style={styles.columnCount}>{m.count > 0 ? m.count : ''}</Text>
                    <View style={styles.columnTrack}>
                      <View
                        style={[
                          styles.columnFill,
                          { height: `${Math.max(m.count > 0 ? 8 : 2, (m.count / maxMonthly) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.columnLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <SectionHeader title={t('reports.deadlineStats')} />
            <Card style={styles.chartCard}>
              <View style={styles.pillRow}>
                <StatPill label={t('reports.completed')} value={deadlineStats.completed} color={colors.success} />
                <StatPill label={t('reports.open')} value={deadlineStats.open} color={colors.info} />
                <StatPill label={t('reports.overdue')} value={deadlineStats.overdue} color={colors.danger} />
              </View>
            </Card>

            <SectionHeader title={t('reports.finance')} />
            <Card style={styles.chartCard}>
              <View style={styles.financeRow}>
                <View style={styles.financeItem}>
                  <Text style={styles.financeLabel}>{t('reports.totalFee')}</Text>
                  <Text style={[styles.financeValue, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(finance.totalFee)}
                  </Text>
                </View>
                <View style={styles.financeItem}>
                  <Text style={styles.financeLabel}>{t('reports.totalCollected')}</Text>
                  <Text style={[styles.financeValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(finance.totalCollected)}
                  </Text>
                </View>
              </View>
              {finance.totalFee > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, (finance.totalCollected / finance.totalFee) * 100)}%` },
                    ]}
                  />
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  chartCard: {
    marginBottom: spacing.lg,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  barLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 86,
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceHover,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
  },
  barCount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    width: 26,
    textAlign: 'right',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
    paddingTop: spacing.xs,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  columnCount: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  columnTrack: {
    width: 22,
    flex: 1,
    justifyContent: 'flex-end',
  },
  columnFill: {
    width: '100%',
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  columnLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: spacing.md,
  },
  pillValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  pillLabel: {
    ...typography.small,
    marginTop: 2,
  },
  financeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  financeItem: {
    flex: 1,
    alignItems: 'center',
  },
  financeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  financeValue: {
    ...typography.h2,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceHover,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.success,
  },
});
