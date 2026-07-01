import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { ClientListItem } from '@/components/clients/ClientListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useClients } from '@/hooks/useClients';
import { spacing } from '@/theme/theme';

export default function ClientDirectoryScreen() {
  const [search, setSearch] = useState('');
  const { data: clients, isLoading, refetch, isRefetching } = useClients(search);

  return (
    <Screen>
      <ScreenHeader title="Clients" subtitle={clients ? `${clients.length} clients` : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search clients" />
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => <ClientListItem client={item} onPress={() => router.push(`/(app)/clients/${item.id}`)} />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No clients yet"
              description="Add a client to start linking cases and contacts."
              actionLabel="New Client"
              onAction={() => router.push('/client-form')}
            />
          ) : null
        }
      />

      <FAB onPress={() => router.push('/client-form')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
});
