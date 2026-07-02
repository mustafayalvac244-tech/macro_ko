import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CaseListItem } from '@/components/cases/CaseListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useCases } from '@/hooks/useCases';
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';
import type { CaseStatus } from '@/types/database';

const STATUS_VALUES: (CaseStatus | 'all')[] = ['all', 'active', 'pending', 'on_hold', 'won', 'lost', 'closed'];

export default function CaseDirectoryScreen() {
  const t = useT();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CaseStatus | 'all'>('all');
  const { data: cases, isLoading, refetch, isRefetching } = useCases({ search, status });

  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(`status.${value}` as const) }));

  return (
    <Screen>
      <ScreenHeader title={t('cases.title')} subtitle={cases ? t('cases.count', { n: cases.length }) : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('cases.search')} />
        <View style={styles.segmentSpacing}>
          <SegmentedControl options={statusOptions} value={status} onChange={setStatus} />
        </View>
      </View>

      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => <CaseListItem caseItem={item} onPress={() => router.push(`/(app)/cases/${item.id}`)} />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="briefcase-outline"
              title={t('cases.empty')}
              description={t('cases.emptyDesc')}
              actionLabel={t('dash.newCase')}
              onAction={() => router.push('/case-form')}
            />
          ) : null
        }
      />

      <FAB onPress={() => router.push('/case-form')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  segmentSpacing: {
    marginTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
});
