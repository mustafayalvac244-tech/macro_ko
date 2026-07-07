import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
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

export default function CalendarScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const updateDeadline = useUpdateDeadline();

  useMemo(() => {
    LocaleConfig.defaultLocale = lang === 'tr' ? 'tr' : '';
  }, [lang]);

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};

    const addDot = (dateKey: string, key: string, color: string) => {
      if (!marks[dateKey]) marks[dateKey] = { dots: [] };
      marks[dateKey].dots.push({ key, color });
    };

    hearings.data?.forEach((h) => addDot(toDateKey(h.scheduled_at), `hearing-${h.id}`, colors.info));
    deadlines.data?.forEach((d) => {
      if (!d.is_completed) addDot(toDateKey(d.due_at), `deadline-${d.id}`, colors.warning);
    });

    if (!marks[selectedDate]) marks[selectedDate] = { dots: [] };
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.primarySoft };

    return marks;
  }, [hearings.data, deadlines.data, selectedDate]);

  const dayHearings = hearings.data?.filter((h) => toDateKey(h.scheduled_at) === selectedDate) ?? [];
  const dayDeadlines = deadlines.data?.filter((d) => toDateKey(d.due_at) === selectedDate) ?? [];

  return (
    <Screen>
      <ScreenHeader showMenu title={t('cal.title')} subtitle={t('cal.subtitle')} />

      <ScrollView contentContainerStyle={styles.content}>
        <Card padded={false} style={styles.calendarCard}>
          <Calendar
            key={lang}
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
            theme={{
              calendarBackground: colors.surface,
              dayTextColor: colors.textPrimary,
              monthTextColor: colors.textPrimary,
              textSectionTitleColor: colors.textMuted,
              todayTextColor: colors.gold,
              arrowColor: colors.primary,
              textDisabledColor: colors.textMuted,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#FFFFFF',
            }}
            style={styles.calendar}
          />
        </Card>

        <View style={styles.legend}>
          <LegendDot color={colors.info} label={t('cal.hearing')} />
          <LegendDot color={colors.warning} label={t('cal.deadline')} />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('cal.hearingsOn', { date: formatDate(selectedDate) })} />
          <Card>
            {dayHearings.length > 0 ? (
              dayHearings.map((hearing, index) => (
                <View key={hearing.id} style={index > 0 ? styles.divider : undefined}>
                  <HearingListItem hearing={hearing} onPress={() => router.push(`/(app)/cases/${hearing.case_id}`)} />
                </View>
              ))
            ) : (
              <EmptyState icon="hammer-outline" title={t('cal.noHearingsDay')} />
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('cal.deadlines')} />
          <Card>
            {dayDeadlines.length > 0 ? (
              dayDeadlines.map((deadline, index) => (
                <View key={deadline.id} style={index > 0 ? styles.divider : undefined}>
                  <DeadlineListItem
                    deadline={deadline}
                    onPress={() => router.push(`/(app)/cases/${deadline.case_id}`)}
                    onToggleComplete={() =>
                      updateDeadline.mutate({
                        id: deadline.id,
                        is_completed: !deadline.is_completed,
                        caseTitle: deadline.case?.title ?? '',
                      })
                    }
                  />
                </View>
              ))
            ) : (
              <EmptyState icon="checkmark-done-outline" title={t('cal.noDeadlinesDay')} />
            )}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  calendarCard: {
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  calendar: {
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textTransform: 'none',
  },
  section: {
    marginBottom: spacing.lg,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
