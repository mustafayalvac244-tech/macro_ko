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
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';

export default function ClientDirectoryScreen() {
  const t = useT();
  const [search, setSearch] = useState('');
  const { data: clients, isLoading, refetch, isRefetching } = useClients(search);

  return (
    <Screen>
      <ScreenHeader showMenu title={t('clients.title')} subtitle={clients ? t('clients.count', { n: clients.length }) : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('clients.search')} />
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
              title={t('clients.empty')}
              description={t('clients.emptyDesc')}
              actionLabel={t('dash.newClient')}
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
