import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { ClientListItem } from '@/components/clients/ClientListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { izgaraDoldur, sutunSayisi } from '@/theme/duzen';
import { FAB } from '@/components/ui/FAB';
import { useClients } from '@/hooks/useClients';
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';

export default function ClientDirectoryScreen() {
  const t = useT();
  // Geniş ekranda iki sütun. Gerekçe ve `key` zorunluluğu dava listesinde
  // ayrıntılı yazılı: app/(app)/cases/index.tsx. Altyapı (sutunSayisi) zaten
  // vardı, yalnız hiçbir ekran kullanmıyordu.
  const { width: pencere } = useWindowDimensions();
  const sutun = sutunSayisi(pencere, 380, 2);

  const [search, setSearch] = useState('');
  const { data: clients, isLoading, refetch, isRefetching } = useClients(search);

  return (
    <Screen>
      <ScreenHeader showMenu title={t('clients.title')} subtitle={clients ? t('clients.count', { n: clients.length }) : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('clients.search')} />
      </View>

      <FlatList
        key={`sutun-${sutun}`}
        numColumns={sutun}
        columnWrapperStyle={sutun > 1 ? styles.satir : undefined}
        data={izgaraDoldur(clients ?? [], sutun)}
        keyExtractor={(item, i) => item?.id ?? `bosluk-${i}`}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => (
          // null = ızgaranın son satırını dengeleyen boşluk (izgaraDoldur).
          <View style={sutun > 1 ? styles.hucre : undefined}>
            {item ? <ClientListItem client={item} onPress={() => router.push(`/(app)/clients/${item.id}`)} /> : null}
          </View>
        )}
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
  satir: {
    gap: spacing.sm,
  },
  hucre: {
    flex: 1,
    minWidth: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
});
