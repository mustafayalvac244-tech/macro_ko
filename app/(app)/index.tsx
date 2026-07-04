import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, isToday } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useLangStore, useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDate } from '@/utils/format';

LocaleConfig.locales.tr = {
  monthNames: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  monthNamesShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  today: 'Bugün',
};

function toDateKey(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd');
}

const BOTH_COLOR = '#7C3AED';

interface DayInfo {
  hearings: number;
  deadlines: number;
}

type AgendaEvent =
  | { kind: 'hearing'; time: number; hearing: NonNullable<ReturnType<typeof useAllHearings>['data']>[number] }
  | { kind: 'deadline'; time: number; deadline: NonNullable<ReturnType<typeof useAllDeadlines>['data']>[number] };

export default function DashboardScreen() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const stats = useDashboardStats();
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const updateDeadline = useUpdateDeadline();

  useMemo(() => {
    LocaleConfig.defaultLocale = lang === 'tr' ? 'tr' : '';
  }, [lang]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  const firstName = profile?.full_name?.split(' ')[0] || t('dash.counselor');

  // How many hearings/deadlines fall on each day (past days included — history
  // stays browsable on the calendar).
  const dayInfo = useMemo(() => {
    const map: Record<string, DayInfo> = {};
    hearings.data?.forEach((h) => {
      const key = toDateKey(h.scheduled_at);
      map[key] = { hearings: (map[key]?.hearings ?? 0) + 1, deadlines: map[key]?.deadlines ?? 0 };
    });
    deadlines.data?.forEach((d) => {
      const key = toDateKey(d.due_at);
      map[key] = { hearings: map[key]?.hearings ?? 0, deadlines: (map[key]?.deadlines ?? 0) + 1 };
    });
    return map;
  }, [hearings.data, deadlines.data]);

  const upcomingCount = useMemo(() => {
    const now = Date.now();
    const weekAhead = addDays(new Date(), 7).getTime();
    let count = 0;
    hearings.data?.forEach((h) => {
      const ts = new Date(h.scheduled_at).getTime();
      if (!h.is_completed && ts >= now && ts <= weekAhead) count += 1;
    });
    deadlines.data?.forEach((d) => {
      const ts = new Date(d.due_at).getTime();
      if (!d.is_completed && ts >= now && ts <= weekAhead) count += 1;
    });
    return count;
  }, [hearings.data, deadlines.data]);

  const dayEvents: AgendaEvent[] = useMemo(() => {
    const events: AgendaEvent[] = [];
    hearings.data?.forEach((h) => {
      if (toDateKey(h.scheduled_at) === selectedDate) {
        events.push({ kind: 'hearing', time: new Date(h.scheduled_at).getTime(), hearing: h });
      }
    });
    deadlines.data?.forEach((d) => {
      if (toDateKey(d.due_at) === selectedDate) {
        events.push({ kind: 'deadline', time: new Date(d.due_at).getTime(), deadline: d });
      }
    });
    return events.sort((a, b) => a.time - b.time);
  }, [hearings.data, deadlines.data, selectedDate]);

  const selectedInfo = dayInfo[selectedDate];

  const agendaTitle = isToday(new Date(selectedDate))
    ? t('dash.agendaToday')
    : t('dash.agendaOn', { date: formatDate(selectedDate) });

  const renderDay = useCallback(
    ({ date, state }: { date?: { dateString: string; day: number }; state?: string }) => {
      if (!date) return <View style={styles.dayCell} />;
      const key = date.dateString;
      const info = dayInfo[key];
      const total = info ? info.hearings + info.deadlines : 0;
      const fill = info
        ? info.hearings > 0 && info.deadlines > 0
          ? BOTH_COLOR
          : info.hearings > 0
            ? colors.primary
            : colors.warning
        : undefined;
      const isSelected = key === selectedDate;
      const isTodayCell = state === 'today';
      const isDisabled = state === 'disabled';

      return (
        <Pressable onPress={() => setSelectedDate(key)} style={styles.dayWrap}>
          <View
            style={[
              styles.dayCell,
              fill ? { backgroundColor: fill } : undefined,
              isSelected && { borderWidth: 2, borderColor: fill ? colors.textPrimary : colors.primary },
            ]}
          >
            <Text
              style={[
                styles.dayText,
                fill
                  ? styles.dayTextOnFill
                  : isDisabled
                    ? styles.dayTextDisabled
                    : isTodayCell
                      ? styles.dayTextToday
                      : undefined,
                isSelected && !fill && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              {date.day}
            </Text>
            {total > 0 && (
              <View style={[styles.countBadge, { borderColor: fill ?? colors.primary }]}>
                <Text style={[styles.countBadgeText, { color: fill ?? colors.primary }]}>{total}</Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [dayInfo, selectedDate]
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting} numberOfLines={1}>
              {t(greetingKey)}, {firstName}
            </Text>
            <Text style={styles.subGreeting}>{profile?.firm_name || t('dash.overview')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              style={styles.bellButton}
              hitSlop={6}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {upcomingCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{upcomingCount > 9 ? '9+' : upcomingCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={44} />
            </Pressable>
          </View>
        </View>

        <Card padded={false} style={styles.calendarCard}>
          <Calendar
            key={lang}
            dayComponent={renderDay}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            enableSwipeMonths
            theme={{
              calendarBackground: colors.surface,
              monthTextColor: colors.textPrimary,
              textMonthFontWeight: '700',
              textSectionTitleColor: colors.textMuted,
              arrowColor: colors.primary,
            }}
            style={styles.calendar}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendLabel}>{t('cal.hearing')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.warning }]} />
              <Text style={styles.legendLabel}>{t('cal.deadline')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: BOTH_COLOR }]} />
              <Text style={styles.legendLabel}>{t('cal.both')}</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendLabel, { color: colors.gold, fontWeight: '700' }]}>{t('cal.today')}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader title={agendaTitle} />

          {selectedInfo && (
            <View style={styles.summaryRow}>
              {selectedInfo.hearings > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: colors.primarySoft }]}>
                  <View style={[styles.summaryDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.summaryText, { color: colors.primary }]}>
                    {t('dash.nHearings', { n: selectedInfo.hearings })}
                  </Text>
                </View>
              )}
              {selectedInfo.deadlines > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: colors.warningSoft }]}>
                  <View style={[styles.summaryDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.summaryText, { color: colors.warning }]}>
                    {t('dash.nDeadlines', { n: selectedInfo.deadlines })}
                  </Text>
                </View>
              )}
            </View>
          )}

          <Card>
            {dayEvents.length > 0 ? (
              dayEvents.map((event, index) => (
                <View
                  key={event.kind === 'hearing' ? `h-${event.hearing.id}` : `d-${event.deadline.id}`}
                  style={index > 0 ? styles.divider : undefined}
                >
                  {event.kind === 'hearing' ? (
                    <HearingListItem hearing={event.hearing} onPress={() => router.push(`/(app)/cases/${event.hearing.case_id}`)} />
                  ) : (
                    <DeadlineListItem
                      deadline={event.deadline}
                      onPress={() => router.push(`/(app)/cases/${event.deadline.case_id}`)}
                      onToggleComplete={() =>
                        updateDeadline.mutate({
                          id: event.deadline.id,
                          is_completed: !event.deadline.is_completed,
                          caseTitle: event.deadline.case?.title ?? '',
                        })
                      }
                    />
                  )}
                </View>
              ))
            ) : (
              <EmptyState icon="calendar-clear-outline" title={t('dash.noEventsDay')} description={t('dash.noEventsDayDesc')} />
            )}
          </Card>
        </View>

        <View style={styles.miniStatsRow}>
          <MiniStat icon="briefcase" color={colors.primary} value={stats.data?.activeCases ?? '—'} label={t('dash.activeCases')} onPress={() => router.push('/(app)/cases')} />
          <MiniStat icon="people" color={colors.gold} value={stats.data?.totalClients ?? '—'} label={t('dash.clients')} onPress={() => router.push('/(app)/clients')} />
          <MiniStat icon="hammer" color={colors.info} value={stats.data?.upcomingHearings ?? '—'} label={t('dash.upcomingHearings')} onPress={() => router.push('/(app)/calendar')} />
          <MiniStat icon="alert-circle" color={colors.warning} value={stats.data?.openDeadlines ?? '—'} label={t('dash.openDeadlines')} onPress={() => router.push('/(app)/calendar')} />
        </View>

        <View style={styles.quickActions}>
          <SectionHeader title={t('dash.quickActions')} />
          <View style={styles.quickActionsRow}>
            <QuickAction icon="add-circle-outline" label={t('dash.newCase')} onPress={() => router.push('/case-form')} />
            <QuickAction icon="person-add-outline" label={t('dash.newClient')} onPress={() => router.push('/client-form')} />
            <QuickAction icon="cloud-upload-outline" label={t('dash.uploadFile')} onPress={() => router.push('/document-upload')} />
            <QuickAction
              icon="stats-chart-outline"
              label={t('dash.reports')}
              onPress={() => router.push('/reports' as Parameters<typeof router.push>[0])}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MiniStat({
  icon,
  color,
  value,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string | number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.miniStat, pressed && styles.pressed]}>
      <View style={[styles.miniStatIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subGreeting: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calendarCard: {
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 16,
  },
  dayWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  dayTextOnFill: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#C4CBD9',
  },
  dayTextToday: {
    color: colors.gold,
    fontWeight: '800',
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 5,
  },
  legendLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    ...typography.caption,
    fontWeight: '700',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  miniStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  miniStatValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  quickActions: {
    marginTop: spacing.lg,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
