import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { fonts, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney, formatTime } from '@/utils/format';

/**
 * Premium ana ekran — başlıklar zarif serifle (Playfair Display), etiketler
 * Manrope ile çizilir. Renkler seçili tema paketinden gelir; koyu temalarda
 * referanstaki gece-lacivert/altın atmosfer korunur.
 */
const SERIF = 'PlayfairDisplay_700Bold';
/** Altın zemin üzerindeki yazı — her temada okunaklı koyu lacivert. */
const ON_GOLD = '#14213D';

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
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
  // Kullanıcı adının başına "Av." yazmış olabilir; tekrar "Av." eklemeyelim.
  const cleanName = (profile?.full_name ?? '').trim().replace(/^av\.?\s+/i, '');
  const firstName = cleanName ? `Av. ${cleanName.split(' ')[0]}` : t('dash.counselor');

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
    <View style={styles.root}>
      <StatusBar style={__t.statusBar} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs, paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------- Üst çubuk ---------- */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Pressable onPress={openSidebar} hitSlop={10}>
              <Ionicons name="menu" size={24} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.brandRow}>
              <VekilLogo size={26} nodeFill={colors.gold} />
              <Text allowFontScaling={false} style={styles.brandText}>Vekil Pro</Text>
            </View>
          </View>
          <View style={styles.toolbarRight}>
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              hitSlop={8}
              style={styles.bellButton}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={34} uri={avatarUrl} premium={profile?.is_premium} />
            </Pressable>
          </View>
        </View>

        {/* ---------- Karşılama ---------- */}
        <Text allowFontScaling={false} style={styles.greeting}>
          {t(greetingKey)}, {firstName}
        </Text>
        <Text allowFontScaling={false} style={styles.greetingSub}>{t('dash.subline')}</Text>

        {/* ---------- Günlük Asistan Özeti ---------- */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroSparkIcon}>
              <Ionicons name="sparkles" size={16} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={styles.heroTitle}>{t('dash.assist.title')}</Text>
              <View style={styles.heroUpdatedRow}>
                <View style={styles.heroDot} />
                <Text allowFontScaling={false} style={styles.heroUpdated}>{t('dash.assist.updated')}</Text>
              </View>
            </View>
          </View>

          {/* 4 satır + 5. satır: Güne Başla */}
          <View style={styles.heroRows} pointerEvents="box-none">
            <AssistRow
              icon="calendar-outline"
              label={t('dash.assist.nextHearing')}
              value={nextHearing ? whenLabel(nextHearing.scheduled_at) : t('dash.assist.noHearing')}
              onPress={() => router.push('/(app)/calendar')}
            />
            <AssistRow
              icon="warning-outline"
              label={t('dash.assist.urgentDue')}
              value={nextDeadline ? whenLabel(nextDeadline.due_at) : t('dash.assist.noDue')}
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
            />
            <AssistRow
              icon="list-outline"
              label={t('dash.todayProgram')}
              value={todayCount > 0 ? t('dash.eventCount', { n: todayCount }) : t('dash.noProgramToday')}
              onPress={() => router.push('/(app)/calendar')}
            />
            <AssistRow
              icon="bulb-outline"
              label={t('dash.assist.suggestion')}
              value={suggestion.value}
              onPress={() => (focus ? router.push(`/(app)/cases/${focus.caseId}`) : router.push('/(app)/calendar'))}
            />
            <Pressable
              style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/calendar')}
            >
              <Text allowFontScaling={false} style={styles.heroCtaText}>{t('dash.assist.start')}</Text>
              <Ionicons name="arrow-forward" size={15} color={ON_GOLD} />
            </Pressable>
          </View>
        </View>

        {/* ---------- Odak Alanı ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="locate-outline" size={15} color={colors.gold} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.focus.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/(app)/cases')} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.critical.all')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </Pressable>
          </View>

          {focus ? (
            <View>
              <View style={styles.focusRow}>
                <View style={styles.focusIcon}>
                  <MaterialCommunityIcons name="briefcase" size={25} color={colors.gold} />
                </View>
                <View style={styles.focusBody}>
                  <Text allowFontScaling={false} style={styles.focusTitle} numberOfLines={2}>
                    {focus.label}
                  </Text>
                  <View style={styles.focusBadge}>
                    <Text allowFontScaling={false} style={styles.focusBadgeText}>{t('dash.focus.high')}</Text>
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
              <Pressable
                style={({ pressed }) => [styles.focusButton, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/(app)/cases/${focus.caseId}`)}
              >
                <Text allowFontScaling={false} style={styles.focusButtonText}>{t('dash.focus.details')}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.gold} />
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
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="stats-chart-outline" size={15} color={colors.gold} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.fin.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/finance' as Parameters<typeof router.push>[0])} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.fin.month')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
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

      {/* ---------- Alt navigasyon ---------- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <BottomTab icon="folder-open" label={t('tab.fileIndex')} active onPress={() => router.push('/(app)/cases')} />
        <BottomTab icon="calendar-outline" label={t('tab.calendar')} onPress={() => router.push('/(app)/calendar')} />
        <BottomTab icon="people-outline" label={t('tab.clients')} onPress={() => router.push('/(app)/clients')} />
      </View>
    </View>
  );
}

function AssistRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  return (
    <Pressable style={({ pressed }) => [styles.assistRow, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={styles.assistIcon}>
        <Ionicons name={icon} size={14} color={colors.gold} />
      </View>
      <View style={styles.assistBody}>
        <Text allowFontScaling={false} style={styles.assistLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text allowFontScaling={false} style={styles.assistValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
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
  const styles = makeStyles(colors);
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
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  return (
    <Pressable style={styles.bottomTab} onPress={onPress}>
      <View style={[styles.bottomTabIndicator, active && styles.bottomTabIndicatorActive]} />
      <Ionicons name={icon} size={20} color={active ? colors.gold : colors.textMuted} />
      <Text
        allowFontScaling={false}
        style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  toolbarLeft: {
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
    fontFamily: fonts.script,
    fontSize: 25,
    color: colors.textPrimary,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellButton: {
    padding: 4,
  },
  greeting: {
    fontFamily: SERIF,
    fontSize: 23,
    lineHeight: 29,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  greetingSub: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroSparkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: SERIF,
    fontSize: 18,
    color: colors.gold,
    letterSpacing: 0.3,
  },
  heroUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  heroUpdated: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  heroRows: {
    gap: 6,
  },
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  assistIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistBody: {
    flex: 1,
  },
  assistLabel: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  assistValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 12.5,
    color: colors.textPrimary,
    marginTop: 1,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    backgroundColor: colors.gold,
    paddingVertical: 12,
    marginTop: 2,
  },
  heroCtaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 13.5,
    color: ON_GOLD,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: SERIF,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardHeaderLink: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.gold,
  },
  focusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  focusIcon: {
    width: 58,
    height: 58,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBody: {
    flex: 1,
  },
  focusTitle: {
    fontFamily: SERIF,
    fontSize: 15.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  focusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  focusBadgeText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 10.5,
    color: colors.danger,
  },
  focusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  focusMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  focusReason: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 5,
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: colors.gold,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  focusButtonText: {
    fontFamily: SERIF,
    fontSize: 14,
    color: colors.gold,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  emptyRowText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
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
    marginHorizontal: spacing.xs,
  },
  finLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  finMidRow: {
    gap: 4,
  },
  finAmount: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  finSpark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
    marginTop: 4,
  },
  finBar: {
    width: 5,
    borderRadius: 2,
  },
  finPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  finPct: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 10.5,
    flexShrink: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 4,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  bottomTabIndicator: {
    width: 30,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },
  bottomTabIndicatorActive: {
    backgroundColor: colors.gold,
  },
  bottomTabLabel: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 11,
    color: colors.textMuted,
  },
  bottomTabLabelActive: {
    color: colors.gold,
    fontFamily: fonts.extrabold,
    fontWeight: '800',
  },
});
