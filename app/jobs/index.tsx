import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDeleteJob, useJobs, useUpdateJobStatus } from '@/hooks/useJobs';
import { isMissingNetworkTables } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDateTime, formatMoney, formatDate } from '@/utils/format';
import type { JobType, JobWithOwner } from '@/types/database';

const TYPE_FILTERS: Array<JobType | 'all'> = ['all', 'tevkil', 'devir', 'danisma'];

export default function JobsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const me = useAuthStore((s) => s.session?.user.id);
  const jobs = useJobs();
  const updateStatus = useUpdateJobStatus();
  const deleteJob = useDeleteJob();

  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const needsSetup = !!jobs.error && isMissingNetworkTables(jobs.error);

  const filtered = useMemo(() => {
    const q = cityFilter.trim().toLocaleLowerCase('tr-TR');
    return (jobs.data ?? []).filter((j) => {
      if (typeFilter !== 'all' && j.job_type !== typeFilter) return false;
      if (q && !j.city.toLocaleLowerCase('tr-TR').includes(q)) return false;
      return true;
    });
  }, [jobs.data, typeFilter, cityFilter]);

  const typeBadge = (type: JobType) => {
    const map: Record<JobType, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
      tevkil: { color: colors.primary, icon: 'swap-horizontal' },
      devir: { color: colors.warning, icon: 'briefcase' },
      danisma: { color: colors.success, icon: 'chatbubbles' },
    };
    return map[type];
  };

  const handleOwnJobPress = (job: JobWithOwner) => {
    Alert.alert(t('jobs.manageTitle'), job.title, [
      { text: t('common.cancel'), style: 'cancel' },
      ...(job.status === 'open'
        ? [{ text: t('jobs.markAssigned'), onPress: () => updateStatus.mutate({ id: job.id, status: 'assigned' as const }) }]
        : []),
      ...(job.status !== 'closed'
        ? [{ text: t('jobs.markClosed'), onPress: () => updateStatus.mutate({ id: job.id, status: 'closed' as const }) }]
        : []),
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteJob.mutate(job.id) },
    ]);
  };

  const renderJob = ({ item }: { item: JobWithOwner }) => {
    const isMine = item.owner_id === me;
    const badge = typeBadge(item.job_type);
    const isOpen = expanded === item.id;
    return (
      <Card style={styles.jobCard} padded={false}>
        <Pressable
          style={styles.jobHeader}
          onPress={() => (isMine ? handleOwnJobPress(item) : setExpanded(isOpen ? null : item.id))}
        >
          <View style={[styles.typeIcon, { backgroundColor: `${badge.color}16` }]}>
            <Ionicons name={badge.icon} size={18} color={badge.color} />
          </View>
          <View style={styles.jobBody}>
            <Text style={styles.jobTitle} numberOfLines={isOpen ? undefined : 2}>
              {item.title}
            </Text>
            <View style={styles.jobMetaRow}>
              <Text style={[styles.typeTag, { color: badge.color }]}>{t(`jobType.${item.job_type}` as const)}</Text>
              <Text style={styles.jobMeta}>· {item.city}</Text>
              {item.hearing_date && <Text style={styles.jobMeta}>· {formatDate(item.hearing_date)}</Text>}
              {item.fee_offer != null && Number(item.fee_offer) > 0 && (
                <Text style={[styles.jobMeta, { color: colors.success, fontWeight: '700' }]}>
                  · {formatMoney(Number(item.fee_offer))}
                </Text>
              )}
            </View>
            <Text style={styles.jobOwner} numberOfLines={1}>
              {isMine ? t('jobs.yours') : (item.owner?.full_name ?? '')}
              {item.status !== 'open' && `  ·  ${t(`jobStatus.${item.status}` as const)}`}
            </Text>
          </View>
          <Ionicons name={isMine ? 'ellipsis-vertical' : isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </Pressable>

        {isOpen && !isMine && (
          <View style={styles.jobDetail}>
            {item.courthouse && (
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>{t('jobs.courthouse')}: </Text>
                {item.courthouse}
              </Text>
            )}
            {item.hearing_date && (
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>{t('jobs.hearingDate')}: </Text>
                {formatDateTime(item.hearing_date)}
              </Text>
            )}
            {item.description && <Text style={styles.detailDesc}>{item.description}</Text>}
            <Pressable
              style={styles.messageButton}
              onPress={() => router.push(`/chat/${item.owner_id}` as Parameters<typeof router.push>[0])}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
              <Text style={styles.messageButtonText}>{t('jobs.message')}</Text>
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('jobs.title')}
        subtitle={t('jobs.subtitle')}
        showBack
        rightIcon="add"
        onRightPress={() => router.push('/job-form' as Parameters<typeof router.push>[0])}
      />

      {needsSetup && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t('network.setupRequired')}</Text>
        </View>
      )}

      <View style={styles.filters}>
        <SegmentedControl
          options={TYPE_FILTERS.map((v) => ({ value: v, label: v === 'all' ? t('jobs.all') : t(`jobType.${v}` as const) }))}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <Input
          placeholder={t('jobs.cityFilter')}
          value={cityFilter}
          onChangeText={setCityFilter}
          icon="location-outline"
          containerStyle={styles.cityInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !needsSetup ? (
            <Card>
              <EmptyState icon="megaphone-outline" title={t('jobs.empty')} description={t('jobs.emptyDesc')} />
            </Card>
          ) : null
        }
        renderItem={renderJob}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  filters: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  cityInput: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
  },
  jobCard: {
    marginBottom: spacing.xs,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobBody: {
    flex: 1,
  },
  jobTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  jobMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  typeTag: {
    ...typography.small,
    fontWeight: '800',
  },
  jobMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  jobOwner: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  jobDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    padding: spacing.sm,
    gap: 6,
  },
  detailLine: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  detailLabel: {
    color: colors.textSecondary,
  },
  detailDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: spacing.xs,
  },
  messageButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
