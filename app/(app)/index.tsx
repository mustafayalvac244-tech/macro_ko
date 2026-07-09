import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useLeaderboard, useMyAnswerToday } from '@/hooks/useDailyQuestion';
import { getTodayQuestion } from '@/constants/dailyQuestions';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

// Dark navy card palette used on the promotional / question cards
const NAVY = '#0F1F3D';
const NAVY_ALT = '#152648';

function countdown(target: Date, now: Date, lang: 'tr' | 'en'): string {
  const diff = target.getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const hh = String(h).padStart(1, '0');
  const mm = String(m).padStart(2, '0');
  if (lang === 'tr') return past ? `-${hh}sa ${mm}dk` : `+${hh}sa ${mm}dk`;
  return past ? `-${hh}h ${mm}m` : `+${hh}h ${mm}m`;
}

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

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
  const myAnswer = useMyAnswerToday();
  const leaderboard = useLeaderboard(4);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  const firstName = profile?.full_name
    ? `Av. ${profile.full_name.split(' ')[0]}`
    : t('dash.counselor');

  const now = new Date();
  const alertCount = useMemo(() => {
    let n = 0;
    hearings.data?.forEach((h) => {
      if (!h.is_completed && isToday(new Date(h.scheduled_at))) n += 1;
    });
    deadlines.data?.forEach((d) => {
      if (!d.is_completed && isToday(new Date(d.due_at))) n += 1;
    });
    return n;
  }, [hearings.data, deadlines.data]);

  // Today's schedule: hearings + deadlines scheduled for today
  const todayItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'hearing' | 'deadline';
      time: Date;
      title: string;
      sub: string;
      location: string | null;
      caseId: string;
    }> = [];
    hearings.data?.forEach((h) => {
      const d = new Date(h.scheduled_at);
      if (!h.is_completed && isToday(d)) {
        items.push({
          id: h.id,
          kind: 'hearing',
          time: d,
          title: h.location || h.case?.title || h.title,
          sub: `${h.case?.case_number ? h.case.case_number + ' - ' : ''}${h.case?.title ?? h.title}`,
          location: h.location,
          caseId: h.case_id,
        });
      }
    });
    deadlines.data?.forEach((dl) => {
      const d = new Date(dl.due_at);
      if (!dl.is_completed && isToday(d)) {
        items.push({
          id: dl.id,
          kind: 'deadline',
          time: d,
          title: dl.title,
          sub: dl.case?.title ?? '',
          location: null,
          caseId: dl.case_id,
        });
      }
    });
    return items.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [hearings.data, deadlines.data]);

  const question = getTodayQuestion(now);

  const rankMedal = (idx: number): { icon: keyof typeof Ionicons.glyphMap; color: string; label: string } => {
    const map: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = [
      { icon: 'diamond', color: '#3EC7F5', label: 'Elmas' },
      { icon: 'medal', color: colors.gold, label: 'Altın' },
      { icon: 'ribbon', color: '#9CA3AF', label: 'Gümüş' },
      { icon: 'trophy', color: '#8B5CF6', label: 'Taç' },
    ];
    return map[idx] ?? map[3]!;
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={openSidebar} hitSlop={8}>
              <Ionicons name="menu" size={26} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.brandRow}>
              <VekilLogo size={30} nodeFill={colors.gold} />
              <Text style={styles.brandText}>Vekil</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              hitSlop={8}
              style={styles.bellButton}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {alertCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{alertCount > 9 ? '9+' : alertCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={44} uri={avatarUrl} />
            </Pressable>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>
          {t(greetingKey)}, {firstName}
        </Text>
        <Text style={styles.greetingSub}>{t('dash.subline')}</Text>

        {/* Hero — Büronuz cebinizde */}
        <View style={styles.hero}>
          <View style={styles.heroBrandRow}>
            <View style={styles.heroBrandIcon}>
              <Ionicons name="scale-outline" size={17} color={colors.gold} />
            </View>
            <Text style={styles.heroBrand}>VEKİL</Text>
          </View>
          <Text style={styles.heroTitle}>{t('hero.title')}</Text>
          <Text style={styles.heroDesc}>{t('hero.desc')}</Text>
          <View style={styles.heroFeatures}>
            <HeroFeature icon="document-text-outline" label={t('hero.f1')} />
            <HeroFeature icon="chatbubbles-outline" label={t('hero.f2')} />
            <HeroFeature icon="calendar-outline" label={t('hero.f3')} />
          </View>
        </View>

        {/* Bugünün Programı */}
        <View style={styles.programCard}>
          <View style={styles.programHeader}>
            <View style={styles.programHeaderLeft}>
              <Ionicons name="calendar-outline" size={19} color={colors.gold} />
              <Text style={styles.programTitle}>{t('dash.todayProgram')}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(app)/calendar')}
              hitSlop={6}
              style={styles.programHeaderRight}
            >
              <Text style={styles.programDate}>{format(now, 'd MMMM yyyy, EEEE', { locale: dateLocale })}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.programBody}>
            {todayItems.length === 0 ? (
              <View style={styles.emptyProgram}>
                <Ionicons name="cafe-outline" size={22} color={colors.textMuted} />
                <Text style={styles.emptyProgramText}>{t('dash.noProgramToday')}</Text>
              </View>
            ) : (
              todayItems.map((item, idx) => (
                <View key={item.id}>
                  {idx > 0 && <View style={styles.programDivider} />}
                  <View style={styles.programSection}>
                    <View style={styles.programSectionHeader}>
                      <Ionicons
                        name={item.kind === 'hearing' ? 'hammer-outline' : 'time-outline'}
                        size={16}
                        color={colors.gold}
                      />
                      <Text style={styles.programSectionTitle}>
                        {item.kind === 'hearing' ? t('dash.upcomingHearing') : t('dash.upcomingTask')}
                      </Text>
                    </View>
                    <View style={styles.programItem}>
                      <View style={styles.programTimeCol}>
                        <Text style={styles.programTime}>{format(item.time, 'HH:mm')}</Text>
                        <Text style={styles.programCountdown}>{countdown(item.time, now, lang)}</Text>
                      </View>
                      <View style={styles.programItemBody}>
                        <Text style={styles.programItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.sub && (
                          <Text style={styles.programItemSub} numberOfLines={1}>
                            {item.sub}
                          </Text>
                        )}
                        {item.location && (
                          <View style={styles.programLocationRow}>
                            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.programLocation}>{item.location}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => router.push(`/(app)/cases/${item.caseId}`)}
                        style={styles.programTag}
                      >
                        <Text style={styles.programTagText}>
                          {item.kind === 'hearing' ? t('cal.hearing') : t('cal.deadline')}
                        </Text>
                      </Pressable>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </View>
                  </View>
                </View>
              ))
            )}

            <Pressable style={styles.programFooter} onPress={() => router.push('/(app)/calendar')}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.programFooterText}>{t('dash.allCalendar')}</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Günün Davası */}
        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <View style={styles.dailyStar}>
              <Ionicons name="star" size={22} color={colors.gold} />
            </View>
            <View style={styles.dailyHeaderBody}>
              <Text style={styles.dailyTitle}>{t('daily.title')}</Text>
              <Text style={styles.dailySub}>{t('daily.subtitle')}</Text>
            </View>
            <View style={styles.pointsBox}>
              <View style={styles.pointsBoxHeader}>
                <Ionicons name="trophy" size={11} color={colors.gold} />
                <Text style={styles.pointsBoxLabel}>{t('daily.todayReward')}</Text>
              </View>
              <Text style={styles.pointsBoxValue}>+100 P</Text>
            </View>
          </View>

          <View style={styles.questionInner}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.gold} style={styles.questionMark} />
            <Text style={styles.questionText}>{question.body}</Text>
            <View style={styles.questionMeta}>
              <View style={styles.questionMetaCell}>
                <Ionicons name="create-outline" size={13} color="rgba(255,255,255,0.75)" />
                <Text style={styles.questionMetaText}>{t('daily.metaLeft')}</Text>
              </View>
              <View style={styles.questionMetaCell}>
                <Ionicons name="star" size={13} color={colors.gold} />
                <Text style={styles.questionMetaText}>{t('daily.metaRight')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.leaderHeader}>
            <Ionicons name="podium-outline" size={16} color={colors.gold} />
            <Text style={styles.leaderTitle}>{t('daily.topAnswerers')}</Text>
          </View>
          <View style={styles.leaderGrid}>
            {[0, 1, 2, 3].map((i) => {
              const entry = leaderboard.data?.[i];
              const medal = rankMedal(i);
              return (
                <View key={i} style={styles.leaderCell}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankBadgeText}>{i + 1}</Text>
                  </View>
                  <View style={[styles.medalIcon, { backgroundColor: `${medal.color}22` }]}>
                    <Ionicons name={medal.icon} size={22} color={medal.color} />
                  </View>
                  <Text style={styles.leaderName} numberOfLines={2}>
                    {entry?.profile?.full_name
                      ? `Av. ${entry.profile.full_name.split(' ').slice(0, 2).join(' ')}`
                      : '—'}
                  </Text>
                  <Text style={styles.leaderPoints}>
                    {entry ? `${entry.points.toLocaleString('tr-TR')} P` : '0 P'}
                  </Text>
                  <View style={[styles.medalTag, { backgroundColor: `${medal.color}22` }]}>
                    <Text style={[styles.medalTagText, { color: medal.color }]}>{medal.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            style={styles.answerButton}
            onPress={() => router.push('/daily-question' as Parameters<typeof router.push>[0])}
          >
            <Ionicons name="pencil" size={17} color="#FFFFFF" />
            <Text style={styles.answerButtonText}>{myAnswer.data ? t('daily.seeAnswer') : t('daily.answer')}</Text>
            <Ionicons name="chevron-forward" size={17} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </Pressable>
        </View>

        {/* Tevkil Panosu reklam */}
        <Pressable
          style={styles.tevkilAd}
          onPress={() => router.push('/jobs' as Parameters<typeof router.push>[0])}
        >
          <View style={styles.tevkilBody}>
            <View style={styles.tevkilChip}>
              <Text style={styles.tevkilChipText}>{t('dash.bannerNew')}</Text>
            </View>
            <Text style={styles.tevkilTitle}>{t('dash.tevkilTitle')}</Text>
            <Text style={styles.tevkilDesc}>{t('dash.tevkilDesc')}</Text>
            <View style={styles.tevkilCta}>
              <Text style={styles.tevkilCtaText}>{t('dash.tevkilCta')}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.gold} />
            </View>
          </View>
          <View style={styles.tevkilArt}>
            <Ionicons name="swap-horizontal" size={38} color={colors.gold} />
          </View>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function HeroFeature({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.heroFeature}>
      <Ionicons name={icon} size={16} color={__t.colors.gold} />
      <Text style={styles.heroFeatureText}>{label}</Text>
    </View>
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
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellButton: {
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    letterSpacing: -0.5,
  },
  greetingSub: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  // Hero
  hero: {
    marginHorizontal: spacing.lg,
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: spacing.lg,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  heroBrandIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(201,162,75,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBrand: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroTitle: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  heroFeatures: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  heroFeature: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  heroFeatureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    flexShrink: 1,
  },
  // Program
  programCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 20,
    padding: spacing.md,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  programHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  programTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  programDate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  programBody: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: spacing.sm,
  },
  programSection: {
    paddingVertical: 4,
  },
  programSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  programSectionTitle: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  programItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  programTimeCol: {
    alignItems: 'center',
    minWidth: 62,
  },
  programTime: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  programCountdown: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  programItemBody: {
    flex: 1,
  },
  programItemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  programItemSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  programLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  programLocation: {
    ...typography.small,
    color: colors.textMuted,
  },
  programTag: {
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  programTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success,
  },
  programDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginVertical: 6,
  },
  programFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  programFooterText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyProgram: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  emptyProgramText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Günün Davası
  dailyCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: spacing.md,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dailyStar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(201,162,75,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201,162,75,0.35)',
  },
  dailyHeaderBody: {
    flex: 1,
  },
  dailyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  dailySub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },
  pointsBox: {
    backgroundColor: 'rgba(201,162,75,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,75,0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pointsBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pointsBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(201,162,75,0.9)',
  },
  pointsBoxValue: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  questionInner: {
    backgroundColor: NAVY_ALT,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  questionMark: {
    marginBottom: 6,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  questionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  questionMetaCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  questionMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  leaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  leaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  leaderGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  leaderCell: {
    flex: 1,
    backgroundColor: NAVY_ALT,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    minHeight: 128,
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  medalIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  leaderName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  leaderPoints: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 4,
  },
  medalTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  medalTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  answerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  // Tevkil ad
  tevkilAd: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: NAVY_ALT,
    borderWidth: 1,
    borderColor: 'rgba(201,162,75,0.2)',
    borderRadius: 20,
  },
  tevkilBody: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  tevkilChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,162,75,0.2)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  tevkilChipText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tevkilTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  tevkilDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  tevkilCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  tevkilCtaText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  tevkilArt: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(201,162,75,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
