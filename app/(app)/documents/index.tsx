import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DocumentListItem } from '@/components/documents/DocumentListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useDeleteDocument, useDocuments, useSignedDocumentUrl } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';
import type { DocumentCategory } from '@/types/database';

const CATEGORY_VALUES: (DocumentCategory | 'all')[] = [
  'all',
  'pleading',
  'contract',
  'evidence',
  'correspondence',
  'court_order',
  'invoice',
  'identification',
  'other',
];

export default function DocumentVaultScreen() {
  const t = useT();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const { data: documents, isLoading, refetch, isRefetching } = useDocuments();
  const signedUrl = useSignedDocumentUrl();
  const deleteDocument = useDeleteDocument();

  const categoryOptions = CATEGORY_VALUES.map((value) => ({
    value,
    label: value === 'all' ? t('status.all') : t(`docCategory.${value}` as const),
  }));

  const filtered = useMemo(() => {
    if (!documents) return [];
    return documents.filter((doc) => {
      const matchesCategory = category === 'all' || doc.category === category;
      const matchesSearch = !search || doc.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [documents, category, search]);

  const handleOpen = async (path: string) => {
    const url = await signedUrl.mutateAsync(path);
    Linking.openURL(url);
  };

  const handleDelete = (id: string, filePath: string, name: string) => {
    Alert.alert(t('docs.deleteTitle'), t('docs.deleteConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteDocument.mutate({ id, file_path: filePath }) },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title={t('docs.title')} subtitle={documents ? t('docs.count', { n: documents.length }) : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('docs.search')} />
        <View style={styles.segmentSpacing}>
          <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => (
          <DocumentListItem
            document={item}
            showCase
            onPress={() => handleOpen(item.file_path)}
            onDelete={() => handleDelete(item.id, item.file_path, item.name)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="folder-open-outline"
              title={t('docs.empty')}
              description={t('docs.emptyDesc')}
              actionLabel={t('docs.uploadDoc')}
              onAction={() => router.push('/document-upload')}
            />
          ) : null
        }
      />

      <FAB icon="cloud-upload-outline" onPress={() => router.push('/document-upload')} />
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
