import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type Tab = 'upcoming' | 'past';

type Item =
  | { kind: 'hearing'; time: number; hearing: NonNullable<ReturnType<typeof useAllHearings>['data']>[number] }
  | { kind: 'deadline'; time: number; deadline: NonNullable<ReturnType<typeof useAllDeadlines>['data']>[number] };

export default function RemindersScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [tab, setTab] = useState<Tab>('upcoming');
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const updateDeadline = useUpdateDeadline();

  const items: Item[] = useMemo(() => {
    const now = Date.now();
    const all: Item[] = [];

    hearings.data?.forEach((h) => {
      const time = new Date(h.scheduled_at).getTime();
      const isPast = h.is_completed || time < now;
      if ((tab === 'past') === isPast) all.push({ kind: 'hearing', time, hearing: h });
    });
    deadlines.data?.forEach((d) => {
      const time = new Date(d.due_at).getTime();
      const isPast = d.is_completed || time < now;
      if ((tab === 'past') === isPast) all.push({ kind: 'deadline', time, deadline: d });
    });

    // Upcoming: soonest first. Past: most recent first.
    return all.sort((a, b) => (tab === 'upcoming' ? a.time - b.time : b.time - a.time));
  }, [hearings.data, deadlines.data, tab]);

  return (
    <Screen>
      <ScreenHeader title={t('reminders.title')} showBack />
      <View style={styles.tabs}>
        <SegmentedControl
          scrollable={false}
          options={[
            { label: t('reminders.upcoming'), value: 'upcoming' },
            { label: t('reminders.past'), value: 'past' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          {items.length > 0 ? (
            items.map((item, index) => (
              <View
                key={item.kind === 'hearing' ? `h-${item.hearing.id}` : `d-${item.deadline.id}`}
                style={index > 0 ? styles.divider : undefined}
              >
                {item.kind === 'hearing' ? (
                  <HearingListItem hearing={item.hearing} onPress={() => router.push(`/(app)/cases/${item.hearing.case_id}`)} />
                ) : (
                  <DeadlineListItem
                    deadline={item.deadline}
                    onPress={() => router.push(`/(app)/cases/${item.deadline.case_id}`)}
                    onToggleComplete={() =>
                      updateDeadline.mutate({
                        id: item.deadline.id,
                        is_completed: !item.deadline.is_completed,
                        caseTitle: item.deadline.case?.title ?? '',
                      })
                    }
                  />
                )}
              </View>
            ))
          ) : tab === 'upcoming' ? (
            <EmptyState icon="notifications-outline" title={t('reminders.emptyUpcoming')} description={t('reminders.emptyUpcomingDesc')} />
          ) : (
            <EmptyState icon="time-outline" title={t('reminders.emptyPast')} description={t('reminders.emptyPastDesc')} />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  tabs: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
