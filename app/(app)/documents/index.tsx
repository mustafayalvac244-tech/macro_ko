import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DocumentListItem } from '@/components/documents/DocumentListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { izgaraDoldur, sutunSayisi } from '@/theme/duzen';
import { Button } from '@/components/ui/Button';
import { useDeleteDocument, useDocuments } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import type { DocumentCategory } from '@/types/database';
import { aramaEslesir } from '@/utils/arama';
import { BELGE_KATEGORILERI } from '@/utils/belgeArsivi';

// Liste tek yerde (utils/belgeArsivi): süzgeçte 'client_photo' eksikti.
const CATEGORY_VALUES: (DocumentCategory | 'all')[] = ['all', ...BELGE_KATEGORILERI];

export default function DocumentVaultScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();
  // Geniş ekranda iki sütun. Gerekçe ve `key` zorunluluğu dava listesinde
  // ayrıntılı yazılı: app/(app)/cases/index.tsx. Altyapı (sutunSayisi) zaten
  // vardı, yalnız hiçbir ekran kullanmıyordu.
  const { width: pencere } = useWindowDimensions();
  const sutun = sutunSayisi(pencere, 360, 2);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const { data: documents, isLoading, isError, refetch, isRefetching } = useDocuments();
  const deleteDocument = useDeleteDocument();

  const categoryOptions = CATEGORY_VALUES.map((value) => ({
    value,
    label: value === 'all' ? t('status.all') : t(`docCategory.${value}` as const),
  }));

  const filtered = useMemo(() => {
    if (!documents) return [];
    return documents.filter((doc) => {
      const matchesCategory = category === 'all' || doc.category === category;
      // TÜRKÇE ARAMA. Burada düz toLowerCase() kullanılıyordu ve Türkçe'de
      // sessizce yanlış sonuç veriyordu: "İcra Takip Talebi" belgesini
      // "icra" yazarak ARAMAK MÜMKÜN DEĞİLDİ ("İ".toLowerCase() birleşik
      // noktalı bir harf üretir). Uygulamanın diğer arama yerleri zaten
      // Türkçe'ye duyarlıydı; burası gözden kaçmıştı.
      const matchesSearch = aramaEslesir(doc.name, search);
      return matchesCategory && matchesSearch;
    });
  }, [documents, category, search]);

  const handleOpen = (item: { file_path: string; name: string; mime_type: string | null }) => {
    router.push(
      `/document-viewer?path=${encodeURIComponent(item.file_path)}&name=${encodeURIComponent(item.name)}&mime=${encodeURIComponent(item.mime_type ?? '')}` as Parameters<typeof router.push>[0]
    );
  };

  const handleDelete = (id: string, filePath: string, name: string) => {
    uyar(t('docs.deleteTitle'), t('docs.deleteConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteDocument.mutate({ id, file_path: filePath }) },
    ]);
  };

  // BELGE YÜKLEME KAPISI (04.10.2026, ürün sahibi: "bu tarafta hiç belge
  // ekle yok ki"). Ekran 12.09'da yazıldığında FAB içe aktarılmış ama hiç
  // çizilmemişti; /document-upload rotasına uygulamanın HİÇBİR yerinden
  // gidilmiyordu. Arşivdeki belgelerin en yenisi Temmuz'dandı (ölçüldü).
  // Etiketli düğme, simgeli FAB'dan iyi: web'de sağ alttaki yuvarlak düğme
  // geniş ekranda gözden kaçıyor.
  const yukle = () => router.push('/document-upload' as Parameters<typeof router.push>[0]);

  return (
    <Screen>
      <ScreenHeader showMenu title={t('docs.title')} subtitle={documents ? t('docs.count', { n: documents.length }) : undefined} />
      <View style={styles.filters}>
        <Button label={t('upload.title')} icon="cloud-upload-outline" onPress={yukle} style={styles.yukle} />
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('docs.search')} />
        <View style={styles.segmentSpacing}>
          <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} />
        </View>
      </View>

      {isError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t('docs.loadError')}</Text>
          <Pressable onPress={() => refetch()} hitSlop={8} accessibilityRole="button" style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('cases.retry')}</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        key={`sutun-${sutun}`}
        numColumns={sutun}
        columnWrapperStyle={sutun > 1 ? styles.satir : undefined}
        data={izgaraDoldur(filtered, sutun)}
        keyExtractor={(item, i) => item?.id ?? `bosluk-${i}`}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => (
          // null = ızgara boşluğu (izgaraDoldur).
          <View style={sutun > 1 ? styles.hucre : undefined}>
            {item ? (
              <DocumentListItem
                document={item}
                showCase
                onPress={() => handleOpen(item)}
                onDelete={() => handleDelete(item.id, item.file_path, item.name)}
              />
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          // Hatada boş durum gösterilmez: üstteki kırmızı kutu "yüklenemedi" der
          // ("Henüz belge yok" demek, belgeleri olana verisi silinmiş gibi gelir).
          !isLoading && !isError ? (
            <EmptyState
              icon="folder-open-outline"
              title={t('docs.empty')}
              description={t('docs.emptyDesc')}
              actionLabel={t('upload.title')}
              onAction={yukle}
            />
          ) : null
        }
      />
    </Screen>
  );
}

// Stiller render anında üretiliyor — modül düzeyinde DEĞİL.
// Yazı tipi/boyut/boşluk/köşe artık temaya bağlı (bkz. src/theme/tokens.ts);
// donuk StyleSheet.create tema değişince eski değerlerde kalır.
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  filters: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  segmentSpacing: {
    marginTop: spacing.sm,
  },
  yukle: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: kose(12),
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  retryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  retryText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
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
