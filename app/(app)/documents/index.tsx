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
import { spacing } from '@/theme/theme';
import type { DocumentCategory } from '@/types/database';

const CATEGORY_OPTIONS: { label: string; value: DocumentCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pleadings', value: 'pleading' },
  { label: 'Contracts', value: 'contract' },
  { label: 'Evidence', value: 'evidence' },
  { label: 'Correspondence', value: 'correspondence' },
  { label: 'Court Orders', value: 'court_order' },
  { label: 'Invoices', value: 'invoice' },
  { label: 'ID', value: 'identification' },
  { label: 'Other', value: 'other' },
];

export default function DocumentVaultScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const { data: documents, isLoading, refetch, isRefetching } = useDocuments();
  const signedUrl = useSignedDocumentUrl();
  const deleteDocument = useDeleteDocument();

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
    Alert.alert('Delete Document', `Delete "${name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDocument.mutate({ id, file_path: filePath }) },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title="Document Vault" subtitle={documents ? `${documents.length} files` : undefined} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search documents" />
        <View style={styles.segmentSpacing}>
          <SegmentedControl options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
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
              title="No documents yet"
              description="Upload pleadings, contracts, and evidence to keep every case file organized."
              actionLabel="Upload Document"
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
