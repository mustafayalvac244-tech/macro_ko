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
import { useClients } from '@/hooks/useClients';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney } from '@/utils/format';
import type { InstanceStage } from '@/types/database';

const OPEN_STAGES: InstanceStage[] = ['ilk_derece', 'istinaf', 'temyiz'];

export default function ReportsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const cases = useCases();
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const financeEntries = useFinanceEntries();
  const clients = useClients();

  const clientTypes = useMemo(() => {
    let gercek = 0;
    let tuzel = 0;
    (clients.data ?? []).forEach((c) => {
      if (c.client_type === 'tuzel') tuzel += 1;
      else gercek += 1; // varsayılan gerçek kişi
    });
    return { gercek, tuzel, total: gercek + tuzel };
  }, [clients.data]);

  // Alper/Burak önerisi: "Aktif" yerine Açık/Kapalı; açık davalar da
  // İlk Derece / İstinaf / Temyiz aşamalarına ayrılsın.
  const caseBreakdown = useMemo(() => {
    let open = 0;
    let closed = 0;
    const stages: Record<InstanceStage, number> = { ilk_derece: 0, istinaf: 0, temyiz: 0 };
    cases.data?.forEach((c) => {
      const isClosed = c.status === 'closed' || c.status === 'won' || c.status === 'lost';
      if (isClosed) {
        closed += 1;
      } else {
        open += 1;
        const st: InstanceStage = c.instance_stage ?? 'ilk_derece';
        stages[st] = (stages[st] ?? 0) + 1;
      }
    });
    return { open, closed, stages };
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

  // Alıcı geri bildirimi: "Genel Finans" yanıltıcıydı (dosya ücretleri düşüyordu).
  // Artık doğrudan Gelir/Gider defterinden (finance_entries) beslenir.
  const finance = useMemo(() => {
    let income = 0;
    let expense = 0;
    (financeEntries.data ?? []).forEach((e) => {
      const amount = Number(e.amount) || 0;
      if (e.kind === 'income') income += amount;
      else expense += amount;
    });
    return { income, expense, net: income - expense };
  }, [financeEntries.data]);

  const totalCases = cases.data?.length ?? 0;
  const maxStage = Math.max(1, ...OPEN_STAGES.map((s) => caseBreakdown.stages[s]));
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
              <View style={styles.pillRow}>
                <StatPill label={t('reports.casesOpen')} value={caseBreakdown.open} color={colors.success} />
                <StatPill label={t('reports.casesClosed')} value={caseBreakdown.closed} color={colors.textMuted} />
              </View>
              {caseBreakdown.open > 0 && (
                <>
                  <Text style={styles.subLabel}>{t('reports.openStages')}</Text>
                  {OPEN_STAGES.map((st) => {
                    const count = caseBreakdown.stages[st];
                    return (
                      <View key={st} style={styles.barRow}>
                        <Text style={styles.barLabel} numberOfLines={1}>
                          {t(`inst.${st}` as const)}
                        </Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${(count / maxStage) * 100}%`, backgroundColor: colors.primary }]} />
                        </View>
                        <Text style={styles.barCount}>{count}</Text>
                      </View>
                    );
                  })}
                </>
              )}
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

            {clientTypes.total > 0 && (
              <>
                <SectionHeader title={`${t('reports.clientTypes')} · ${clientTypes.total}`} />
                <Card style={styles.chartCard}>
                  <View style={styles.pillRow}>
                    <StatPill label={t('reports.gercek')} value={clientTypes.gercek} color={colors.info} />
                    <StatPill label={t('reports.tuzel')} value={clientTypes.tuzel} color={colors.gold} />
                  </View>
                </Card>
              </>
            )}

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
                  <Text style={styles.financeLabel}>{t('dash.fin.income')}</Text>
                  <Text style={[styles.financeValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(finance.income)}
                  </Text>
                </View>
                <View style={styles.financeItem}>
                  <Text style={styles.financeLabel}>{t('dash.fin.expense')}</Text>
                  <Text style={[styles.financeValue, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(finance.expense)}
                  </Text>
                </View>
                <View style={styles.financeItem}>
                  <Text style={styles.financeLabel}>{t('dash.fin.net')}</Text>
                  <Text
                    style={[styles.financeValue, { color: finance.net >= 0 ? colors.success : colors.danger }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatMoney(finance.net)}
                  </Text>
                </View>
              </View>
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
  subLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: 2,
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
