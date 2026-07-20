import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useAllHearings } from '@/hooks/useHearings';
import { useMorningDigest } from '@/hooks/useMorningDigest';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useLangStore, useT } from '@/i18n';
import { shadow, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney, formatTime } from '@/utils/format';

// Dark navy palette for the assistant hero + Tevkil banner
const NAVY = '#0F1F3D';
const NAVY_ALT = '#152648';
const BLUE = '#5EA2FF';
const AMBER = '#F5B849';
const GREEN = '#4ED596';

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const insets = useSafeAreaInsets();

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const dateLocale = lang === 'tr' ? trLocale : enUS;
  const profile = useAuthStore((s) => s.profile);
  const avatarUrl = useAvatarUrl();
  const openSidebar = useSidebarStore((s) => s.open);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const finance = useFinanceEntries();
  useMorningDigest();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const now = new Date();
  const hour = now.getHours();
  const greetingKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  const firstName = profile?.full_name ? `Av. ${profile.full_name.split(' ')[0]}` : t('dash.counselor');

  // "Bugün · 10:30" / "Yarın · 18:00" / "13 Tem · 09:00"
  const whenLabel = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const day = isToday(d) ? t('fmt.today') : isTomorrow(d) ? t('fmt.tomorrow') : format(d, 'd MMM', { locale: dateLocale });
      return `${day} · ${formatTime(iso)}`;
    },
    [t, dateLocale]
  );

  // Bugün planlı işlem sayısı (duruşma + görev) — asistan satırında gösterilir.
  const todayCount = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const toKey = (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
    };
    const h = (hearings.data ?? []).filter((x) => !x.is_completed && toKey(x.scheduled_at) === todayKey).length;
    const d = (deadlines.data ?? []).filter((x) => !x.is_completed && toKey(x.due_at) === todayKey).length;
    return h + d;
  }, [hearings.data, deadlines.data]);

  const nextHearing = useMemo(() => {
    return (hearings.data ?? [])
      .filter((h) => {
        const d = new Date(h.scheduled_at);
        return !h.is_completed && !isNaN(d.getTime()) && d.getTime() >= now.getTime() - 60 * 60 * 1000;
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings.data]);

  const nextDeadline = useMemo(() => {
    return (deadlines.data ?? [])
      .filter((d) => !d.is_completed && !isNaN(new Date(d.due_at).getTime()))
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  }, [deadlines.data]);

  const criticalCount = useMemo(
    () =>
      (deadlines.data ?? []).filter((d) => {
        if (d.is_completed) return false;
        const due = new Date(d.due_at);
        if (isNaN(due.getTime())) return false;
        return due.getTime() < now.getTime() || isToday(due) || d.priority === 'high';
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deadlines.data]
  );

  // Focus case: the case behind the most pressing deadline, else next hearing's case.
  const focus = useMemo(() => {
    if (nextDeadline?.case) {
      return {
        caseId: nextDeadline.case_id,
        label: `${nextDeadline.case.case_number ? nextDeadline.case.case_number + ' – ' : ''}${nextDeadline.case.title}`,
        hearingWhen: nextHearing && nextHearing.case_id === nextDeadline.case_id ? whenLabel(nextHearing.scheduled_at) : null,
        reason: t('dash.focus.reasonDue', { title: nextDeadline.title }),
      };
    }
    if (nextHearing?.case) {
      return {
        caseId: nextHearing.case_id,
        label: `${nextHearing.case.case_number ? nextHearing.case.case_number + ' – ' : ''}${nextHearing.case.title}`,
        hearingWhen: whenLabel(nextHearing.scheduled_at),
        reason: t('dash.focus.reasonHearing'),
      };
    }
    return null;
  }, [nextDeadline, nextHearing, whenLabel, t]);

  // Suggested step heuristic
  const suggestion = useMemo(() => {
    if (nextDeadline) return { value: t('dash.assist.sugDeadline'), right: nextDeadline.title };
    if (nextHearing) return { value: t('dash.assist.sugHearing'), right: nextHearing.case?.title ?? nextHearing.title };
    return { value: t('dash.assist.sugCalendar'), right: t('tab.calendar') };
  }, [nextDeadline, nextHearing, t]);

  // Finance summary: this month vs last month (+ net cash flow)
  const fin = useMemo(() => {
    const entries = finance.data ?? [];
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = (dateStr: string, year: number, month: number) => {
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    };
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    let income = 0;
    let expense = 0;
    let prevIncome = 0;
    let prevExpense = 0;
    const incomeSeries: number[] = new Array(8).fill(0);
    const expenseSeries: number[] = new Array(8).fill(0);
    entries.forEach((e) => {
      const amount = Number(e.amount) || 0;
      if (inMonth(e.entry_date, y, m)) {
        const day = new Date(e.entry_date).getDate();
        const bucket = Math.min(7, Math.floor((day - 1) / 4));
        if (e.kind === 'income') {
          income += amount;
          incomeSeries[bucket] = (incomeSeries[bucket] ?? 0) + amount;
        } else {
          expense += amount;
          expenseSeries[bucket] = (expenseSeries[bucket] ?? 0) + amount;
        }
      } else if (inMonth(e.entry_date, prevY, prevM)) {
        if (e.kind === 'income') prevIncome += amount;
        else prevExpense += amount;
      }
    });
    const pct = (cur: number, prev: number) => (prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);
    const netSeries = incomeSeries.map((v, i) => Math.max(0, v - (expenseSeries[i] ?? 0)));
    return {
      income,
      expense,
      net: income - expense,
      incomePct: pct(income, prevIncome),
      expensePct: pct(expense, prevExpense),
      netPct: pct(income - expense, prevIncome - prevExpense),
      incomeSeries,
      expenseSeries,
      netSeries,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finance.data]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------- Header ---------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {router.canGoBack() && (
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
              </Pressable>
            )}
            <Pressable onPress={openSidebar} hitSlop={8}>
              <Ionicons name="menu" size={26} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.brandRow}>
              <VekilLogo size={28} nodeFill={colors.gold} />
              <Text allowFontScaling={false} style={styles.brandText}>Vekil Pro</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              hitSlop={8}
              style={styles.bellButton}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={42} uri={avatarUrl} premium={profile?.is_premium} />
            </Pressable>
          </View>
        </View>

        {/* ---------- Greeting ---------- */}
        <Text allowFontScaling={false} style={styles.greeting}>
          {t(greetingKey)}, {firstName}
        </Text>
        <Text allowFontScaling={false} style={styles.greetingSub}>{t('dash.subline')}</Text>

        {/* ---------- Günlük Asistan Özeti ---------- */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroSparkIcon}>
              <Ionicons name="sparkles" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={styles.heroTitle}>{t('dash.assist.title')}</Text>
              <Text allowFontScaling={false} style={styles.heroUpdated}>{t('dash.assist.updated')}</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            {/* Sol: 4 asistan satırı */}
            <View style={styles.heroRows} pointerEvents="box-none">
            <AssistRow
              icon="calendar-outline"
              tint={BLUE}
              label={t('dash.assist.nextHearing')}
              value={nextHearing ? whenLabel(nextHearing.scheduled_at) : t('dash.assist.noHearing')}
              right={nextHearing ? (nextHearing.location || nextHearing.case?.title || nextHearing.title) : ''}
              onPress={() => router.push('/(app)/calendar')}
            />
            <AssistRow
              icon="warning-outline"
              tint={AMBER}
              label={t('dash.assist.urgentDue')}
              value={nextDeadline ? whenLabel(nextDeadline.due_at) : t('dash.assist.noDue')}
              right={nextDeadline ? nextDeadline.title : ''}
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
            />
            <AssistRow
              icon="list-outline"
              tint={GREEN}
              label={t('dash.todayProgram')}
              value={todayCount > 0 ? t('dash.eventCount', { n: todayCount }) : t('dash.noProgramToday')}
              right=""
              onPress={() => router.push('/(app)/calendar')}
            />
            <AssistRow
              icon="bulb-outline"
              tint={colors.gold}
              label={t('dash.assist.suggestion')}
              value={suggestion.value}
              right={suggestion.right}
              onPress={() => (focus ? router.push(`/(app)/cases/${focus.caseId}`) : router.push('/(app)/calendar'))}
            />
            </View>

            {/* Sağ: temiz vektör terazi + Güne Başla */}
            <View style={styles.heroSide}>
              <View style={styles.heroScale}>
                <MaterialCommunityIcons name="scale-balance" size={62} color={colors.gold} />
              </View>
              <Pressable
                style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                onPress={() => router.push('/(app)/calendar')}
              >
                <Text allowFontScaling={false} style={styles.heroCtaText}>{t('dash.assist.start')}</Text>
                <Ionicons name="arrow-forward" size={14} color={NAVY} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ---------- Odak Alanı ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: colors.goldSoft }]}>
                <Ionicons name="locate-outline" size={18} color={colors.gold} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.focus.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/(app)/cases')} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.critical.all')}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          </View>

          {focus ? (
            <View>
              <View style={styles.focusRow}>
                <View style={styles.focusIcon}>
                  <Ionicons name="folder-open" size={26} color={colors.gold} />
                </View>
                <View style={styles.focusBody}>
                  <View style={styles.focusTitleRow}>
                    <Text allowFontScaling={false} style={styles.focusTitle} numberOfLines={2}>
                      {focus.label}
                    </Text>
                    <View style={styles.focusBadge}>
                      <Text allowFontScaling={false} style={styles.focusBadgeText}>{t('dash.focus.high')}</Text>
                    </View>
                  </View>
                  {focus.hearingWhen && (
                    <View style={styles.focusMetaRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                      <Text allowFontScaling={false} style={styles.focusMeta} numberOfLines={1}>
                        {t('cal.hearing')}: {focus.hearingWhen}
                      </Text>
                    </View>
                  )}
                  <Text allowFontScaling={false} style={styles.focusReason} numberOfLines={2}>
                    {focus.reason}
                  </Text>
                </View>
              </View>
              {/* Buton tam genişlik, altta */}
              <Pressable style={styles.focusButton} onPress={() => router.push(`/(app)/cases/${focus.caseId}`)}>
                <Text allowFontScaling={false} style={styles.focusButtonText}>{t('dash.focus.details')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              <Text allowFontScaling={false} style={styles.emptyRowText}>{t('dash.focus.empty')}</Text>
            </View>
          )}
        </View>

        {/* ---------- Finansal Özet ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: colors.goldSoft }]}>
                <Ionicons name="stats-chart-outline" size={18} color={colors.gold} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.fin.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/finance' as Parameters<typeof router.push>[0])} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.fin.month')}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.finRow}>
            <FinCell label={t('dash.fin.income')} amount={fin.income} pct={fin.incomePct} positiveIsGood series={fin.incomeSeries} barColor={colors.success} vsLabel={t('dash.fin.vs')} />
            <View style={styles.finDivider} />
            <FinCell label={t('dash.fin.expense')} amount={fin.expense} pct={fin.expensePct} positiveIsGood={false} series={fin.expenseSeries} barColor={colors.danger} vsLabel={t('dash.fin.vs')} />
            <View style={styles.finDivider} />
            <FinCell label={t('dash.fin.net')} amount={fin.net} pct={fin.netPct} positiveIsGood series={fin.netSeries} barColor={colors.success} vsLabel={t('dash.fin.vs')} />
          </View>
        </View>

      </ScrollView>

      {/* ---------- Bottom bar ---------- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Test geri bildirimi: "Ana sayfa" (zaten buradayız) ve "Diğer" (☰ ile
            aynı iş) sekmeleri kaldırıldı — üç net kısayol kaldı. */}
        <BottomTab icon="folder-outline" label={t('tab.files')} onPress={() => router.push('/(app)/documents')} />
        <BottomTab icon="calendar-outline" label={t('tab.calendar')} onPress={() => router.push('/(app)/calendar')} />
        <BottomTab icon="people-outline" label={t('tab.clients')} onPress={() => router.push('/(app)/clients')} />
      </View>
    </Screen>
  );
}

function AssistRow({
  icon,
  tint,
  label,
  value,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
  right: string;
  onPress: () => void;
}) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <Pressable style={styles.assistRow} onPress={onPress}>
      <View style={[styles.assistIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <View style={styles.assistBody}>
        <View style={styles.assistTopRow}>
          <Text allowFontScaling={false} style={styles.assistLabel} numberOfLines={1}>
            {label}
          </Text>
          {!!right && (
            <Text allowFontScaling={false} style={styles.assistRight} numberOfLines={1}>
              {right}
            </Text>
          )}
        </View>
        <Text allowFontScaling={false} style={styles.assistValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={__t.colors.textMuted} />
    </Pressable>
  );
}

function FinCell({
  label,
  amount,
  pct,
  positiveIsGood,
  series,
  barColor,
  vsLabel,
}: {
  label: string;
  amount: number;
  pct: number | null;
  positiveIsGood: boolean;
  series: number[];
  barColor: string;
  vsLabel: string;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const max = Math.max(...series, 1);
  const hasData = series.some((v) => v > 0);
  // Veri yokken bile mockup'taki gibi renkli bir dalga görünsün.
  const placeholder = [7, 10, 8, 13, 10, 15, 12];
  const heights = hasData
    ? series.slice(0, 7).map((v) => 4 + Math.round((v / max) * 18))
    : placeholder;
  const good = pct == null ? true : positiveIsGood ? pct >= 0 : pct <= 0;
  return (
    <View style={styles.finCell}>
      <Text allowFontScaling={false} style={styles.finLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.finMidRow}>
        <Text allowFontScaling={false} style={styles.finAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(amount)}
        </Text>
        <View style={styles.finSpark}>
          {heights.map((h, i) => (
            <View
              key={i}
              style={[styles.finBar, { height: h, backgroundColor: barColor, opacity: hasData ? 0.9 : 0.35 }]}
            />
          ))}
        </View>
      </View>
      <View style={styles.finPctRow}>
        {pct != null ? (
          <>
            <Ionicons name={pct >= 0 ? 'arrow-up' : 'arrow-down'} size={11} color={good ? colors.success : colors.danger} />
            <Text allowFontScaling={false} style={[styles.finPct, { color: good ? colors.success : colors.danger }]} numberOfLines={2}>
              %{Math.abs(pct)} {vsLabel}
            </Text>
          </>
        ) : (
          <Text allowFontScaling={false} style={[styles.finPct, { color: colors.textMuted }]} numberOfLines={2}>
            %0 {vsLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

function BottomTab({
  icon,
  label,
  active,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  return (
    <Pressable style={styles.bottomTab} onPress={onPress}>
      <View style={[styles.bottomTabIconWrap, active && styles.bottomTabActive]}>
        <Ionicons name={icon} size={21} color={active ? colors.gold : colors.textMuted} />
        {!!badge && badge > 0 && (
          <View style={styles.bottomTabBadge}>
            <Text allowFontScaling={false} style={styles.bottomTabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text allowFontScaling={false} style={[styles.bottomTabLabel, active && { color: colors.gold, fontWeight: '800' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bellButton: {
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  msgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  msgPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  msgPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  // Hero — Günlük Asistan
  hero: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 22,
    padding: spacing.md,
    paddingBottom: spacing.md,
    ...shadow.card,
  },
  heroSide: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroScale: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroSparkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(201,162,75,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  heroUpdated: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 1,
  },
  heroRows: {
    flex: 1,
    gap: 8,
  },
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  assistIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistBody: {
    flex: 1,
  },
  assistTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  assistLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '600',
    flexShrink: 0,
  },
  assistValue: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 1,
  },
  assistRight: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 10.5,
    textAlign: 'right',
  },
  heroBody: {
    flexDirection: 'row',
    gap: 10,
  },
  heroCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  heroCtaText: {
    color: NAVY,
    fontSize: 12.5,
    fontWeight: '800',
  },
  // Generic card
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 20,
    padding: spacing.md,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    marginRight: 6,
  },
  cardHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  cardHeaderLink: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  emptyRowText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  // Odak Alanı
  focusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  focusIcon: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBody: {
    flex: 1,
  },
  focusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  focusTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  focusBadge: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  focusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.danger,
  },
  focusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  focusMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  focusReason: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  focusButton: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 13,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  focusButtonText: {
    color: colors.gold,
    fontSize: 12.5,
    fontWeight: '800',
  },
  // İletişim özeti
  commRow3: {
    flexDirection: 'row',
  },
  commCol: {
    flex: 1,
    minWidth: 0,
  },
  commColCenter: {
    alignItems: 'center',
  },
  commDivider: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 6,
  },
  commIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  commIconBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  commIconBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  commPeerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  commQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  commQuickItem: {
    alignItems: 'center',
    gap: 3,
  },
  commQuickBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commQuickLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  commLink: {
    fontSize: 10.5,
    color: colors.info,
    fontWeight: '800',
    marginTop: 5,
  },
  commLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 5,
  },
  commValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  commPeerName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  commPeerTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  commPreview: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 5,
  },
  // Finance
  finRow: {
    flexDirection: 'row',
  },
  finCell: {
    flex: 1,
    paddingHorizontal: 2,
  },
  finDivider: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 6,
  },
  finLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  finMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  finAmount: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  finSpark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 20,
    width: 28,
  },
  finBar: {
    flex: 1,
    borderRadius: 2,
  },
  finPctRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
    marginTop: 5,
  },
  finPct: {
    fontSize: 9,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 12,
  },
  // Tevkil banner
  tevkilAd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: 'rgba(201,162,75,0.25)',
    borderRadius: 20,
  },
  tevkilArt: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(201,162,75,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(201,162,75,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tevkilBody: {
    flex: 1,
  },
  tevkilTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
  },
  tevkilDesc: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 8,
    paddingHorizontal: 6,
    // Yukarı doğru hafif gölge — içeriğin barın altına aktığını hissettirir.
    shadowColor: '#1A2C51',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  bottomTabIconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabActive: {
    backgroundColor: colors.goldSoft,
  },
  bottomTabBadge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bottomTabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  bottomTabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
