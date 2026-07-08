import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useDocuments } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { spacing, typography, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatDateTime, relativeDueLabel } from '@/utils/format';

type AgendaItem =
  | { kind: 'hearing'; time: number; id: string; title: string; sub: string; caseId: string }
  | { kind: 'deadline'; time: number; id: string; title: string; sub: string; caseId: string };

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const avatarUrl = useAvatarUrl();
  const openSidebar = useSidebarStore((s) => s.open);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const stats = useDashboardStats();
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const documents = useDocuments();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  const firstName = profile?.full_name?.split(' ')[0] || t('dash.counselor');

  // "Uyarılar": items due within the next 7 days (incl. overdue, not completed)
  const alertCount = useMemo(() => {
    const weekAhead = addDays(new Date(), 7).getTime();
    let count = 0;
    hearings.data?.forEach((h) => {
      if (!h.is_completed && new Date(h.scheduled_at).getTime() <= weekAhead) count += 1;
    });
    deadlines.data?.forEach((d) => {
      if (!d.is_completed && new Date(d.due_at).getTime() <= weekAhead) count += 1;
    });
    return count;
  }, [hearings.data, deadlines.data]);

  // Personal command center: next 5 upcoming items across hearings & tasks
  const upcoming = useMemo<AgendaItem[]>(() => {
    const now = Date.now() - 6 * 60 * 60 * 1000; // keep items from earlier today visible
    const items: AgendaItem[] = [];
    hearings.data?.forEach((h) => {
      const ts = new Date(h.scheduled_at).getTime();
      if (!h.is_completed && ts >= now) {
        items.push({
          kind: 'hearing',
          time: ts,
          id: h.id,
          title: h.case?.title ?? h.title,
          sub: `${h.title} · ${formatDateTime(h.scheduled_at)}`,
          caseId: h.case_id,
        });
      }
    });
    deadlines.data?.forEach((d) => {
      const ts = new Date(d.due_at).getTime();
      if (!d.is_completed && ts >= now) {
        items.push({
          kind: 'deadline',
          time: ts,
          id: d.id,
          title: d.title,
          sub: `${d.case?.title ?? ''} · ${relativeDueLabel(d.due_at)}`,
          caseId: d.case_id,
        });
      }
    });
    return items.sort((a, b) => a.time - b.time).slice(0, 5);
  }, [hearings.data, deadlines.data]);

  const recentDocs = useMemo(() => (documents.data ?? []).slice(0, 3), [documents.data]);

  const openDocument = (doc: (typeof recentDocs)[number]) => {
    router.push(
      `/document-viewer?path=${encodeURIComponent(doc.file_path)}&name=${encodeURIComponent(doc.name)}&mime=${encodeURIComponent(doc.mime_type ?? '')}` as Parameters<typeof router.push>[0]
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header: hamburger + wordmark | bell + profile */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={openSidebar} style={styles.iconButton} hitSlop={6}>
              <Ionicons name="menu" size={24} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.brandRow}>
              <VekilLogo size={30} nodeFill={colors.primary} />
              <Text style={styles.brandText}>Vekil Pro</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              style={styles.iconButton}
              hitSlop={6}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {alertCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={42} uri={avatarUrl} />
            </Pressable>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>
          {t(greetingKey)}, {firstName}
        </Text>

        {/* Swipeable quick stats */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
          style={styles.statsScroll}
        >
          <StatCardItem
            icon="briefcase-outline"
            label={t('dash.statFiles')}
            value={stats.data?.activeCases ?? '—'}
            tint={colors.primary}
            onPress={() => router.push('/(app)/cases')}
          />
          <StatCardItem
            icon="people-outline"
            label={t('dash.statClients')}
            value={stats.data?.totalClients ?? '—'}
            tint={colors.success}
            onPress={() => router.push('/(app)/clients')}
          />
          <StatCardItem
            icon="checkbox-outline"
            label={t('dash.statTasks')}
            value={stats.data?.openDeadlines ?? '—'}
            tint={colors.gold}
            onPress={() => router.push('/(app)/calendar')}
          />
          <StatCardItem
            icon="alert-circle-outline"
            label={t('dash.statAlerts')}
            value={alertCount}
            tint={colors.danger}
            onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
          />
        </ScrollView>

        {/* Promotional banner */}
        <Pressable
          style={styles.banner}
          onPress={() => router.push('/jobs' as Parameters<typeof router.push>[0])}
        >
          <View style={styles.bannerBody}>
            <View style={styles.bannerChip}>
              <Text style={styles.bannerChipText}>{t('dash.bannerNew')}</Text>
            </View>
            <Text style={styles.bannerTitle}>{t('dash.bannerTitle')}</Text>
            <Text style={styles.bannerDesc}>{t('dash.bannerDesc')}</Text>
            <View style={styles.bannerCta}>
              <Text style={styles.bannerCtaText}>{t('dash.bannerCta')}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </View>
          <View style={styles.bannerArt}>
            <View style={styles.bannerArtCircle}>
              <Ionicons name="swap-horizontal" size={34} color="#FFFFFF" />
            </View>
            <View style={[styles.bannerArtDot, { top: 8, right: 6 }]} />
            <View style={[styles.bannerArtDot, { bottom: 14, left: 2, width: 8, height: 8 }]} />
          </View>
        </Pressable>

        {/* Personal command center */}
        <Text style={styles.sectionTitle}>{t('dash.commandCenter')}</Text>

        {upcoming.length === 0 && recentDocs.length === 0 ? (
          <Card>
            <EmptyState icon="calendar-clear-outline" title={t('dash.noDeadlines')} description={t('dash.noDeadlinesDesc')} />
          </Card>
        ) : (
          <View style={styles.listWrap}>
            {upcoming.map((item) => (
              <View key={`${item.kind}-${item.id}`} style={styles.listItem}>
                <View
                  style={[
                    styles.listIcon,
                    { backgroundColor: item.kind === 'hearing' ? colors.primarySoft : colors.warningSoft },
                  ]}
                >
                  <Ionicons
                    name={item.kind === 'hearing' ? 'hammer-outline' : 'time-outline'}
                    size={19}
                    color={item.kind === 'hearing' ? colors.primary : colors.warning}
                  />
                </View>
                <View style={styles.listBody}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.listSub} numberOfLines={1}>
                    {item.sub}
                  </Text>
                </View>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primarySoft }]}
                  onPress={() => router.push(`/(app)/cases/${item.caseId}`)}
                >
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('dash.goToCase')}</Text>
                </Pressable>
              </View>
            ))}

            {recentDocs.map((doc) => (
              <View key={doc.id} style={styles.listItem}>
                <View style={[styles.listIcon, { backgroundColor: colors.goldSoft }]}>
                  <Ionicons name="folder-outline" size={19} color={colors.gold} />
                </View>
                <View style={styles.listBody}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <Text style={styles.listSub} numberOfLines={1}>
                    {doc.case?.title ? `${doc.case.title} · ` : ''}
                    {formatDate(doc.uploaded_at)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.successSoft }]}
                  onPress={() => openDocument(doc)}
                >
                  <Text style={[styles.actionButtonText, { color: colors.success }]}>{t('dash.viewDoc')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatCardItem({
  icon,
  label,
  value,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tint: string;
  onPress: () => void;
}) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.85 }]}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}14` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandText: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statsScroll: {
    flexGrow: 0,
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 6,
  },
  statCard: {
    width: 118,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadow.card,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    overflow: 'hidden',
  },
  bannerBody: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  bannerChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  bannerChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  bannerDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  bannerCtaText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  bannerArt: {
    width: 78,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerArtCircle: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerArtDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  listWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    ...shadow.card,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBody: {
    flex: 1,
  },
  listTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  listSub: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
