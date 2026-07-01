import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useUpcomingHearings } from '@/hooks/useHearings';
import { useUpcomingDeadlines, useUpdateDeadline } from '@/hooks/useDeadlines';
import { colors, spacing, typography } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const stats = useDashboardStats();
  const hearings = useUpcomingHearings(4);
  const deadlines = useUpcomingDeadlines(4);
  const updateDeadline = useUpdateDeadline();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Counselor';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day, {firstName}</Text>
            <Text style={styles.subGreeting}>{profile?.firm_name || 'Your practice overview'}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')}>
            <Avatar name={profile?.full_name || 'Attorney'} size={44} />
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Active Cases"
            value={stats.data?.activeCases ?? '—'}
            icon="briefcase-outline"
            accentColor={colors.primary}
            onPress={() => router.push('/(app)/cases')}
          />
          <StatCard
            label="Clients"
            value={stats.data?.totalClients ?? '—'}
            icon="people-outline"
            accentColor={colors.gold}
            onPress={() => router.push('/(app)/clients')}
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            label="Upcoming Hearings"
            value={stats.data?.upcomingHearings ?? '—'}
            icon="hammer-outline"
            accentColor={colors.info}
            onPress={() => router.push('/(app)/calendar')}
          />
          <StatCard
            label="Open Deadlines"
            value={stats.data?.openDeadlines ?? '—'}
            icon="alert-circle-outline"
            accentColor={colors.warning}
            onPress={() => router.push('/(app)/calendar')}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Upcoming Hearings" actionLabel="View calendar" onAction={() => router.push('/(app)/calendar')} />
          <Card>
            {hearings.data && hearings.data.length > 0 ? (
              hearings.data.map((hearing, index) => (
                <View key={hearing.id} style={index > 0 ? styles.divider : undefined}>
                  <HearingListItem hearing={hearing} onPress={() => router.push(`/(app)/cases/${hearing.case_id}`)} />
                </View>
              ))
            ) : (
              <EmptyState icon="hammer-outline" title="No upcoming hearings" description="Scheduled hearings will appear here." />
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Critical Deadlines" actionLabel="View all" onAction={() => router.push('/(app)/calendar')} />
          <Card>
            {deadlines.data && deadlines.data.length > 0 ? (
              deadlines.data.map((deadline, index) => (
                <View key={deadline.id} style={index > 0 ? styles.divider : undefined}>
                  <DeadlineListItem
                    deadline={deadline}
                    onPress={() => router.push(`/(app)/cases/${deadline.case_id}`)}
                    onToggleComplete={() => {
                      updateDeadline.mutate({
                        id: deadline.id,
                        is_completed: !deadline.is_completed,
                        caseTitle: deadline.case?.title ?? '',
                      });
                    }}
                  />
                </View>
              ))
            ) : (
              <EmptyState icon="checkmark-done-outline" title="No open deadlines" description="You're fully caught up." />
            )}
          </Card>
        </View>

        <View style={styles.quickActions}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsRow}>
            <QuickAction icon="add-circle-outline" label="New Case" onPress={() => router.push('/case-form')} />
            <QuickAction icon="person-add-outline" label="New Client" onPress={() => router.push('/client-form')} />
            <QuickAction icon="cloud-upload-outline" label="Upload File" onPress={() => router.push('/document-upload')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}>
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
    marginBottom: spacing.lg,
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
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  quickActions: {
    marginTop: spacing.lg,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    paddingVertical: spacing.md,
  },
  quickActionPressed: {
    opacity: 0.8,
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
