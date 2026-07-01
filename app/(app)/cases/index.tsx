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
import { spacing } from '@/theme/theme';
import type { CaseStatus } from '@/types/database';

const STATUS_OPTIONS: { label: string; value: CaseStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
  { label: 'Closed', value: 'closed' },
];

export default function CaseDirectoryScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CaseStatus | 'all'>('all');
  const { data: cases, isLoading, refetch, isRefetching } = useCases({ search, status });

  return (
    <Screen>
      <ScreenHeader title="Case Directory" subtitle={cases ? `${cases.length} cases` : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search cases" />
        <View style={styles.segmentSpacing}>
          <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={setStatus} />
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
              title="No cases yet"
              description="Create your first case to start tracking hearings, deadlines, and documents."
              actionLabel="New Case"
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
