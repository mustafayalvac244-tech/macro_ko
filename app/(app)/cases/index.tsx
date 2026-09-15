import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CaseListItem } from '@/components/cases/CaseListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { izgaraDoldur, sutunSayisi } from '@/theme/duzen';
import { FAB } from '@/components/ui/FAB';
import { useCases } from '@/hooks/useCases';
import { useAllHearings } from '@/hooks/useHearings';
import { isMissingEnforcementTable, useEnforcements } from '@/hooks/useEnforcements';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';
import type { CaseWithClient, EnforcementWithClient } from '@/types/database';

const STATUS_VALUES = ['all', 'open', 'closed'] as const;

type Row =
  | { kind: 'case'; date: string; item: CaseWithClient }
  | { kind: 'enf'; date: string; item: EnforcementWithClient };

export default function CaseDirectoryScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();
  // Kart 420 px'in altına düşerse tek sütuna dönülüyor: bu kartta ikon,
  // başlık, mahkeme, esas no ve rozetler var; daha dar olunca rozetler
  // alt satıra taşıp kart yüksekliğini düzensizleştiriyor.
  const { width: pencere } = useWindowDimensions();
  const sutun = sutunSayisi(pencere, 420, 2);


  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [newModal, setNewModal] = useState(false);
  const { data: cases, isLoading, refetch, isRefetching } = useCases({ search, status });
  const enforcements = useEnforcements(search);
  const hearings = useAllHearings();

  // Her dava için sıradaki (gelecek, tamamlanmamış) duruşma/keşif tarihi.
  const nextHearingByCase = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, string>();
    (hearings.data ?? []).forEach((h) => {
      if (h.is_completed || !h.case_id) return;
      const ts = new Date(h.scheduled_at).getTime();
      if (ts < now) return;
      const cur = m.get(h.case_id);
      if (!cur || ts < new Date(cur).getTime()) m.set(h.case_id, h.scheduled_at);
    });
    return m;
  }, [hearings.data]);

  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(`caseFilter.${value}` as const) }));

  // Dava + icra dosyaları tek dizinde; açılış/takip tarihine göre yeni → eski.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    (cases ?? []).forEach((c) => out.push({ kind: 'case', date: c.opened_date ?? c.created_at, item: c }));
    (enforcements.data ?? [])
      .filter((e) => {
        if (status === 'open') return e.stage !== 'closed';
        if (status === 'closed') return e.stage === 'closed';
        return true;
      })
      .forEach((e) => out.push({ kind: 'enf', date: e.start_date ?? e.created_at, item: e }));
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [cases, enforcements.data, status]);

  return (
    <Screen>
      <ScreenHeader showMenu title={t('tab.fileIndex')} subtitle={t('cases.count', { n: rows.length })} />
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('cases.search')} />
        <View style={styles.segmentSpacing}>
          <SegmentedControl scrollable={false} options={statusOptions} value={status} onChange={setStatus} />
        </View>
      </View>

      {enforcements.error && isMissingEnforcementTable(enforcements.error) && (
        <Text style={styles.setupNote}>{t('enf.setupRequired')}</Text>
      )}

      {/* GENİŞ EKRANDA İKİ SÜTUN — 14.09.2026.
          Ölçüldü: 1440 px'lik tarayıcıda her kart 1120 px genişliğindeydi ama
          içerik solda ~450 px'te bitiyordu; kartın sağ yarısı boştu ve ekrana
          yalnız DÖRT dosya sığıyordu. 200 dosyalı bir avukat için bu, listeyi
          kullanılamaz yapar.

          `sutunSayisi` zaten src/theme/duzen.ts'te duruyordu ve hiçbir ekran
          kullanmıyordu — yeni altyapı yazılmadı, var olan uygulandı.
          Natifte ve dar tarayıcıda 1 dönüyor, yani telefonda hiçbir şey
          değişmiyor.

          `key` ŞART: React Native, numColumns uçuşta değişince listeyi
          yeniden kurmak yerine hata veriyor ("Changing numColumns on the fly
          is not supported"). Pencere yeniden boyutlandırıldığında sütun
          sayısı değiştiği için anahtar da değişmeli. */}
      <FlatList
        key={`sutun-${sutun}`}
        numColumns={sutun}
        columnWrapperStyle={sutun > 1 ? styles.satir : undefined}
        data={izgaraDoldur(rows, sutun)}
        keyExtractor={(row, i) => (row ? `${row.kind}-${row.item.id}` : `bosluk-${i}`)}
        contentContainerStyle={styles.listContent}
        onRefresh={() => {
          refetch();
          enforcements.refetch();
        }}
        refreshing={isRefetching}
        renderItem={({ item: row }) => (
          // minWidth:0 olmadan uzun dava başlıkları hücreyi şişirip sütunları
          // eşitsiz yapıyor (flex kutularının varsayılan min genişliği içeriğe
          // göre belirleniyor).
          // null = ızgara boşluğu (izgaraDoldur).
          <View style={sutun > 1 ? styles.hucre : undefined}>
            {!row ? null : row.kind === 'case' ? (
              <CaseListItem
                caseItem={row.item}
                nextHearingAt={nextHearingByCase.get(row.item.id)}
                esitYukseklik={sutun > 1}
                onPress={() => router.push(`/(app)/cases/${row.item.id}`)}
              />
            ) : (
              <EnforcementRow
                file={row.item}
                onPress={() => router.push(`/enforcement/${row.item.id}` as Parameters<typeof router.push>[0])}
              />
            )}
          </View>
        )}
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

      <FAB onPress={() => setNewModal(true)} />

      {/* Yeni dosya: dava mı, icra takibi mi? */}
      <Modal visible={newModal} transparent animationType="fade" onRequestClose={() => setNewModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setNewModal(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('file.newChoiceTitle')}</Text>
            <Text style={styles.sheetSub}>{t('file.newChoiceSub')}</Text>

            <Pressable
              style={styles.choiceRow}
              onPress={() => {
                setNewModal(false);
                router.push('/case-form');
              }}
            >
              <View style={[styles.choiceIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.choiceText}>{t('dash.newCase')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={styles.choiceRow}
              onPress={() => {
                setNewModal(false);
                router.push('/enforcement-form' as Parameters<typeof router.push>[0]);
              }}
            >
              <View style={[styles.choiceIcon, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="hammer-outline" size={22} color={colors.warning} />
              </View>
              <Text style={styles.choiceText}>{t('enf.new')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function EnforcementRow({ file, onPress }: { file: EnforcementWithClient; onPress: () => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  return (
    <Pressable style={({ pressed }) => [styles.enfRow, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={styles.enfIcon}>
        <Ionicons name="hammer-outline" size={20} color={colors.warning} />
      </View>
      <View style={styles.enfBody}>
        <View style={styles.enfTitleRow}>
          <Text style={styles.enfTitle} numberOfLines={1}>
            {file.debtor_name}
          </Text>
          <View style={styles.enfBadge}>
            <Text style={styles.enfBadgeText}>{t('enf.badge')}</Text>
          </View>
        </View>
        <Text style={styles.enfSub} numberOfLines={1}>
          {[
            file.client?.full_name,
            [file.office_name, file.file_number].filter(Boolean).join(' '),
            t(`enf.stage.${file.stage}` as const),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text style={styles.enfDate}>{formatDate(`${file.start_date}T12:00:00`)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  satir: {
    gap: spacing.sm,
  },
  hucre: {
    flex: 1,
    minWidth: 0,
  },
  setupNote: {
    ...typography.small,
    color: colors.warning,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  enfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: kose(16),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  enfIcon: {
    width: 42,
    height: 42,
    borderRadius: kose(14),
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enfBody: {
    flex: 1,
  },
  enfTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  enfTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  enfBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: kose(6),
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  enfBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  enfSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  enfDate: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: kose(24),
    borderTopRightRadius: kose(24),
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: kose(2),
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sheetSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: kose(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
  },
});
