import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useCases } from '@/hooks/useCases';
import { useCasePrecedents, caseSearchTerm } from '@/hooks/useCasePrecedents';
import { useAllHearings } from '@/hooks/useHearings';
import { useMorningDigest } from '@/hooks/useMorningDigest';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useAdvanceDeficits } from '@/hooks/useClientAdvances';
import { useAdvanceAlertStore } from '@/store/advanceAlertStore';
import { useLangStore, useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney, formatTime } from '@/utils/format';

/**
 * Premium ana ekran — başlıklar zarif serifle (Playfair Display), etiketler
 * Manrope ile çizilir. Renkler seçili tema paketinden gelir; "Güne Başla"
 * butonu ve çanta karosu altın gradyanla dolgun bir görünüm alır.
 */
const SERIF = 'PlayfairDisplay_700Bold';

/** Zengin, metalik altın — açık temaların koyu/kahverengi altını yerine kullanılır. */
const RICH_GOLD = '#D4AF37';

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * Vurgu altını: tema altını yeterince parlaksa (koyu temalar) onu kullan; koyu/
 * mat (açık temalar) ise zengin metalik altına geç — "Güne Başla" ve çanta her
 * temada gerçek altın görünsün, kahverengi durmasın.
 */
function accentGoldFor(themeGold: string): string {
  return luminance(themeGold) < 0.6 ? RICH_GOLD : themeGold;
}

/** Altın zemin üzerindeki yazı/ikon rengi: parlak altında koyu lacivert, koyu altında beyaz. */
function onGoldColor(hex: string): string {
  return luminance(hex) > 0.6 ? '#14213D' : '#FFFFFF';
}

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const accentGold = accentGoldFor(colors.gold);

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

  // Davana Emsal: aktif davalar + seçili davanın konusuna göre Yargıtay emsalleri.
  const openCases = useCases({ status: 'open' });
  const caseList = openCases.data ?? [];
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCase = useMemo(
    () => caseList.find((c) => c.id === selectedCaseId) ?? caseList[0] ?? null,
    [caseList, selectedCaseId]
  );
  const precTerm = caseSearchTerm(selectedCase);
  const precedents = useCasePrecedents(precTerm);

  // Masraf avansı eksiye düşen müvekkiller (kapatılanlar hariç) — ana ekran uyarısı.
  const advanceDeficits = useAdvanceDeficits();
  const dismissedAlerts = useAdvanceAlertStore((s) => s.dismissed);
  const dismissAlert = useAdvanceAlertStore((s) => s.dismiss);
  const advanceAlerts = useMemo(
    () => (advanceDeficits.data ?? []).filter((d) => !dismissedAlerts.includes(d.id)),
    [advanceDeficits.data, dismissedAlerts]
  );

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
    // Alıcı geri bildirimi: Arabuluculuk/toplantı türü kayıtlar "Sonraki duruşma"
    // olarak gösterilmemeli — sadece gerçek duruşmalar (duruşma/celse) sayılır.
    const hearingTypes = ['hearing', 'trial', 'deposition'];
    return (hearings.data ?? [])
      .filter((h) => {
        const d = new Date(h.scheduled_at);
        return (
          !h.is_completed &&
          hearingTypes.includes(h.type) &&
          !isNaN(d.getTime()) &&
          d.getTime() >= now.getTime() - 60 * 60 * 1000
        );
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
  // ZAMAN-DUYARLI: yakın olmayan (haftalar sonraki) bir duruşmayı "acil/yüksek
  // öncelik" gibi göstermeyip sakin bir sayaçla ("N gün kaldı") sunar — boşuna
  // telaşlandırmaz (Burak geri bildirimi).
  const focus = useMemo(() => {
    const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    if (nextDeadline?.case) {
      const days = daysLeft(nextDeadline.due_at);
      return {
        caseId: nextDeadline.case_id,
        label: `${nextDeadline.case.case_number ? nextDeadline.case.case_number + ' – ' : ''}${nextDeadline.case.title}`,
        hearingWhen: nextHearing && nextHearing.case_id === nextDeadline.case_id ? whenLabel(nextHearing.scheduled_at) : null,
        days,
        reason:
          days <= 7
            ? t('dash.focus.reasonDue', { title: nextDeadline.title })
            : t('dash.focus.reasonDueFar', { title: nextDeadline.title, n: days }),
      };
    }
    if (nextHearing?.case) {
      const days = daysLeft(nextHearing.scheduled_at);
      return {
        caseId: nextHearing.case_id,
        label: `${nextHearing.case.case_number ? nextHearing.case.case_number + ' – ' : ''}${nextHearing.case.title}`,
        hearingWhen: whenLabel(nextHearing.scheduled_at),
        days,
        reason: days <= 7 ? t('dash.focus.reasonHearing') : t('dash.focus.reasonHearingFar', { n: days }),
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
              <MaterialCommunityIcons name="scale-balance" size={22} color={colors.gold} />
              <Text allowFontScaling={false} style={styles.brandText}>
                Vekil<Text style={styles.brandTextPro}> Pro</Text>
              </Text>
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

          {/* 4 satır + tam genişlik "Güne Başla" */}
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
              style={({ pressed }) => [styles.heroCta, { backgroundColor: accentGold }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/calendar')}
            >
              <Text allowFontScaling={false} style={[styles.heroCtaText, { color: onGoldColor(accentGold) }]}>{t('dash.assist.start')}</Text>
              <Ionicons name="arrow-forward" size={15} color={onGoldColor(accentGold)} />
            </Pressable>
          </View>
        </View>

        {/* ---------- Masraf avansı uyarısı (kapatılabilir) ---------- */}
        {advanceAlerts.length > 0 && (
          <View style={styles.advanceAlert}>
            <View style={styles.advanceAlertHead}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text allowFontScaling={false} style={styles.advanceAlertTitle}>{t('dash.advance.title')}</Text>
            </View>
            {advanceAlerts.slice(0, 4).map((d) => (
              <View key={d.id} style={styles.advanceAlertRow}>
                <Pressable style={styles.advanceAlertInfo} onPress={() => router.push(`/(app)/clients/${d.id}`)}>
                  <Text allowFontScaling={false} style={styles.advanceAlertName} numberOfLines={1}>{d.name}</Text>
                  <Text allowFontScaling={false} style={styles.advanceAlertAmount}>
                    {t('dash.advance.need', { amount: formatMoney(d.deficit) })}
                  </Text>
                </Pressable>
                <Pressable onPress={() => dismissAlert(d.id)} hitSlop={8} style={styles.advanceAlertClose}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            {advanceAlerts.length > 4 && (
              <Text allowFontScaling={false} style={styles.advanceAlertMore}>
                {t('dash.advance.more', { n: advanceAlerts.length - 4 })}
              </Text>
            )}
          </View>
        )}

        {/* ---------- Davana Emsal ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="library-outline" size={15} color={colors.gold} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.prec.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/ictihat' as Parameters<typeof router.push>[0])} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.prec.link')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </Pressable>
          </View>

          {caseList.length === 0 ? (
            <View style={styles.precEmpty}>
              <Ionicons name="library-outline" size={22} color={colors.gold} />
              <Text allowFontScaling={false} style={styles.precEmptyText}>{t('dash.prec.emptyCases')}</Text>
              <Pressable
                style={({ pressed }) => [styles.focusButton, { marginTop: spacing.sm }, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/case-form' as Parameters<typeof router.push>[0])}
              >
                <Ionicons name="add" size={16} color={colors.gold} />
                <Text allowFontScaling={false} style={styles.focusButtonText}>{t('dash.prec.addCase')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {/* Hangi dava? — birden çok aktif dava varsa seçilebilir çip sırası. */}
              {caseList.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.precChipRow}
                >
                  {caseList.slice(0, 12).map((c) => {
                    const active = c.id === selectedCase?.id;
                    const label = (c.case_type?.trim() || c.title || '').trim();
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedCaseId(c.id)}
                        style={[styles.precChip, active && styles.precChipActive]}
                      >
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.precChipText, active && styles.precChipTextActive]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <Text allowFontScaling={false} style={styles.precForLine} numberOfLines={2}>
                {t('dash.prec.forCase', { term: precTerm || (selectedCase?.title ?? '') })}
              </Text>

              {precedents.isLoading ? (
                <View style={styles.precLoading}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text allowFontScaling={false} style={styles.precLoadingText}>{t('dash.prec.searching')}</Text>
                </View>
              ) : precedents.isError ? (
                <View style={styles.precLoading}>
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
                  <Text allowFontScaling={false} style={styles.precLoadingText}>{t('dash.prec.errSource')}</Text>
                  <Pressable onPress={() => precedents.refetch()} hitSlop={6}>
                    <Text allowFontScaling={false} style={styles.precRetry}>{t('dash.prec.retry')}</Text>
                  </Pressable>
                </View>
              ) : (precedents.data?.hits.length ?? 0) === 0 ? (
                <View style={styles.emptyRow}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <Text allowFontScaling={false} style={styles.emptyRowText}>{t('dash.prec.none')}</Text>
                </View>
              ) : (
                <View>
                  {precedents.data!.hits.slice(0, 3).map((h) => (
                    <Pressable
                      key={h.id}
                      style={({ pressed }) => [styles.precRow, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push(('/ictihat?q=' + encodeURIComponent(precTerm)) as Parameters<typeof router.push>[0])}
                    >
                      <View style={styles.precRowIcon}>
                        <Ionicons name="document-text-outline" size={16} color={colors.gold} />
                      </View>
                      <View style={styles.precRowBody}>
                        <View style={styles.precDaireRow}>
                          <Text allowFontScaling={false} style={styles.precDaire} numberOfLines={1}>
                            {h.daire || t('dash.prec.title')}
                          </Text>
                          {h.matched === false && (
                            <View style={styles.precBadge}>
                              <Text allowFontScaling={false} style={styles.precBadgeText}>{t('dash.prec.near')}</Text>
                            </View>
                          )}
                        </View>
                        <Text allowFontScaling={false} style={styles.precMeta} numberOfLines={1}>
                          {[h.esasNo && `E.${h.esasNo}`, h.kararNo && `K.${h.kararNo}`, h.kararTarihi]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </Text>
                        {!!h.snippet && (
                          <Text allowFontScaling={false} style={styles.precSnippet} numberOfLines={2}>
                            {h.snippet}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                  <Pressable
                    style={({ pressed }) => [styles.focusButton, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(('/ictihat?q=' + encodeURIComponent(precTerm)) as Parameters<typeof router.push>[0])}
                  >
                    <Text allowFontScaling={false} style={styles.focusButtonText}>
                      {t('dash.prec.seeAll')}
                      {precedents.data!.total > 3 ? `  (${precedents.data!.total})` : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.gold} />
                  </Pressable>
                </View>
              )}
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
        <BottomTab icon="folder-open-outline" label={t('tab.fileIndex')} active onPress={() => router.push('/(app)/cases')} />
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
        <Ionicons name={icon} size={15} color={colors.gold} />
      </View>
      <View style={styles.assistBody}>
        <Text allowFontScaling={false} style={styles.assistLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text allowFontScaling={false} style={styles.assistValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
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
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  brandTextPro: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    color: colors.gold,
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
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
    letterSpacing: -0.7,
  },
  greetingSub: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 5,
    marginBottom: spacing.lg,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  // Masraf avansı uyarısı
  advanceAlert: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  advanceAlertHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  advanceAlertTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  advanceAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.dangerSoft,
  },
  advanceAlertInfo: {
    flex: 1,
  },
  advanceAlertName: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  advanceAlertAmount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.danger,
    marginTop: 1,
  },
  advanceAlertClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceAlertMore: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroSparkIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
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
    gap: 0,
  },
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  assistIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistBody: {
    flex: 1,
  },
  assistLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  assistValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 14.5,
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    marginTop: spacing.md,
  },
  heroCtaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 14,
    color: onGoldColor(colors.gold),
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
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
    gap: spacing.xs,
  },
  cardHeaderIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16.5,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardHeaderLink: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 13,
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
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingHorizontal: 11,
    paddingVertical: 3,
    marginTop: 7,
  },
  focusBadgeText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 11,
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
    borderRadius: 13,
    backgroundColor: colors.goldSoft,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  focusButtonText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: -0.1,
    color: colors.gold,
  },
  // Davana Emsal
  precChipRow: {
    gap: 6,
    paddingBottom: spacing.sm,
    paddingRight: 4,
  },
  precChip: {
    maxWidth: 190,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  precChipActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },
  precChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12,
    color: colors.textSecondary,
  },
  precChipTextActive: {
    color: colors.gold,
  },
  precForLine: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  precLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  precLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  precRetry: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.gold,
  },
  precRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  precRowIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  precRowBody: {
    flex: 1,
  },
  precDaireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  precDaire: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  precBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  precBadgeText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 9.5,
    color: colors.textMuted,
  },
  precMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  precSnippet: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  precEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  precEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
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
