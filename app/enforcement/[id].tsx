import { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  isMissingEnforcementTable,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useDeleteEnforcement,
  useEnforcement,
  useUpdateEnforcement,
} from '@/hooks/useEnforcements';
import { useT } from '@/i18n';
import { fonts, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { computeKapak } from '@/utils/kapak';
import { formatDate, formatMoney } from '@/utils/format';
import type { CollectionSource, EnforcementStage } from '@/types/database';

const STAGES: EnforcementStage[] = ['opened', 'served', 'objected', 'final', 'attachment', 'sale', 'closed'];
const SOURCES: CollectionSource[] = ['payment', 'attachment', 'sale', 'other'];

function parseMoney(s: string): number {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function EnforcementDetailScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: file, error } = useEnforcement(id);
  const collections = useCollections(id);
  const updateEnforcement = useUpdateEnforcement();
  const deleteEnforcement = useDeleteEnforcement();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();

  const [collModal, setCollModal] = useState(false);
  const [collAmount, setCollAmount] = useState('');
  const [collDate, setCollDate] = useState(new Date());
  const [collSource, setCollSource] = useState<CollectionSource>('payment');
  const [collNote, setCollNote] = useState('');
  const [showCollPicker, setShowCollPicker] = useState(false);

  const kapak = useMemo(
    () => (file ? computeKapak(file, collections.data ?? []) : null),
    [file, collections.data]
  );

  if (!file) {
    return (
      <Screen>
        <ScreenHeader title={t('enf.title')} showBack />
        {error && isMissingEnforcementTable(error) && (
          <Text style={styles.setupNote}>{t('enf.setupRequired')}</Text>
        )}
      </Screen>
    );
  }

  const pct = kapak && kapak.takipCikisi > 0 ? Math.min(100, Math.round((kapak.collected / (kapak.collected + kapak.remaining || 1)) * 100)) : 0;

  const submitCollection = async () => {
    const amount = parseMoney(collAmount);
    if (amount <= 0) return;
    await createCollection.mutateAsync({
      enforcement_id: file.id,
      amount,
      collected_at: format(collDate, 'yyyy-MM-dd'),
      source: collSource,
      note: collNote.trim() || null,
    });
    setCollModal(false);
    setCollAmount('');
    setCollNote('');
    setCollSource('payment');
    setCollDate(new Date());
  };

  const handleDelete = () => {
    Alert.alert(t('enf.delete'), t('enf.deleteConfirm', { name: file.debtor_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEnforcement.mutateAsync(file.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={file.debtor_name}
        subtitle={[file.office_name, file.file_number].filter(Boolean).join(' · ') || t(`enf.type.${file.takip_type}` as const)}
        showBack
        rightIcon="create-outline"
        onRightPress={() => router.push(`/enforcement-form?id=${file.id}` as Parameters<typeof router.push>[0])}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Güncel kapak hesabı */}
        {kapak && (
          <Card style={styles.kapakCard}>
            <View style={styles.kapakHead}>
              <Text style={styles.kapakLabel}>{t('enf.kapak')}</Text>
              <Text style={styles.kapakDate}>{t('enf.kapakAsOf', { date: formatDate(new Date().toISOString()) })}</Text>
            </View>
            <Text style={styles.kapakValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(kapak.remaining)}
            </Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>{t('enf.progress', { pct })}</Text>

            <View style={styles.bdWrap}>
              <BdRow label={t('enf.takipCikisiShort')} value={formatMoney(kapak.takipCikisi)} />
              <BdRow label={t('enf.bd.principal')} value={formatMoney(kapak.remainingPrincipal)} />
              <BdRow label={t('enf.bd.interest')} value={formatMoney(kapak.remainingInterest)} />
              <BdRow label={t('enf.bd.expenses')} value={formatMoney(kapak.remainingExpenses)} />
              <BdRow label={t('enf.bd.collected')} value={formatMoney(kapak.collected)} color={colors.success} />
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={14} color={colors.info} />
              <Text style={styles.infoText}>{t('enf.interestInfo')}</Text>
            </View>
          </Card>
        )}

        {/* Safha */}
        <Text style={styles.sectionTitle}>{t('enf.stage')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
          {STAGES.map((s) => {
            const active = file.stage === s;
            return (
              <Pressable
                key={s}
                style={[styles.stageChip, active && styles.stageChipActive]}
                onPress={() => updateEnforcement.mutate({ id: file.id, stage: s })}
              >
                <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>
                  {t(`enf.stage.${s}` as const)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tahsilatlar */}
        <View style={styles.collHead}>
          <Text style={styles.sectionTitle}>{t('enf.collections')}</Text>
          <Pressable style={styles.addBtn} onPress={() => setCollModal(true)}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addBtnText}>{t('enf.addCollection')}</Text>
          </Pressable>
        </View>
        <Card padded={false}>
          {(collections.data ?? []).length === 0 ? (
            <Text style={styles.emptyText}>{t('enf.noCollections')}</Text>
          ) : (
            (collections.data ?? []).map((c, i) => (
              <View key={c.id} style={[styles.collRow, i > 0 && styles.divider]}>
                <View style={styles.collIcon}>
                  <Ionicons name="cash-outline" size={16} color={colors.success} />
                </View>
                <View style={styles.collBody}>
                  <Text style={styles.collAmount}>{formatMoney(Number(c.amount))}</Text>
                  <Text style={styles.collSub} numberOfLines={1}>
                    {formatDate(`${c.collected_at}T12:00:00`)} · {t(`enf.source.${c.source}` as const)}
                    {c.note ? ` · ${c.note}` : ''}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert(t('enf.deleteCollection'), formatMoney(Number(c.amount)), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCollection.mutate(c.id) },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))
          )}
        </Card>

        {/* Notlar */}
        {!!file.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.notesLabel}>{t('enf.notes')}</Text>
            <Text style={styles.notesText}>{file.notes}</Text>
          </Card>
        )}

        {/* Aksiyonlar */}
        <Button
          label={t('enf.addTask')}
          variant="secondary"
          onPress={() =>
            router.push(
              `/deadline-form?title=${encodeURIComponent(`${file.debtor_name} — icra`)}` as Parameters<typeof router.push>[0]
            )
          }
          style={styles.actionBtn}
        />
        <Button label={t('enf.delete')} variant="danger" onPress={handleDelete} style={styles.actionBtn} />
      </ScrollView>

      {/* Tahsilat ekleme */}
      <Modal visible={collModal} transparent animationType="fade" onRequestClose={() => setCollModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCollModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('enf.addCollection')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('enf.collAmount')}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={collAmount}
              onChangeText={setCollAmount}
              autoFocus
            />
            <Pressable style={styles.modalDate} onPress={() => setShowCollPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.modalDateText}>{formatDate(collDate.toISOString())}</Text>
            </Pressable>
            {showCollPicker && (
              <DateTimePicker locale="tr-TR"
                value={collDate}
                mode="date"
                display={Platform.OS === 'android' ? 'spinner' : 'default'}
                onChange={(_e, date) => {
                  if (Platform.OS === 'android') setShowCollPicker(false);
                  if (date) setCollDate(date);
                }}
              />
            )}
            {Platform.OS === 'ios' && showCollPicker && (
              <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowCollPicker(false)} style={styles.pickerDone} />
            )}
            <View style={styles.modalSeg}>
              <SegmentedControl
                options={SOURCES.map((s) => ({ value: s, label: t(`enf.source.${s}` as const) }))}
                value={collSource}
                onChange={setCollSource}
              />
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder={t('enf.collNote')}
              placeholderTextColor={colors.textMuted}
              value={collNote}
              onChangeText={setCollNote}
            />
            <View style={styles.modalActions}>
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setCollModal(false)} style={styles.modalBtn} />
              <Button
                label={t('common.save')}
                onPress={submitCollection}
                loading={createCollection.isPending}
                disabled={!collAmount.trim()}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function BdRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.bdRow}>
      <Text style={styles.bdLabel}>{label}</Text>
      <Text style={[styles.bdValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  setupNote: {
    ...typography.caption,
    color: colors.warning,
    paddingHorizontal: spacing.lg,
  },
  kapakCard: {
    marginBottom: spacing.md,
  },
  kapakHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kapakLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  kapakDate: {
    ...typography.small,
    color: colors.textMuted,
  },
  kapakValue: {
    fontSize: 34,
    fontFamily: fonts.bold,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  progressText: {
    ...typography.small,
    color: colors.success,
    marginTop: 4,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  bdWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
  },
  bdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  bdLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bdValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: colors.infoSoft,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    marginTop: spacing.xs,
  },
  infoText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stageRow: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  stageChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  stageChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stageChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  stageChipTextActive: {
    color: '#FFFFFF',
  },
  collHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  addBtnText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  collRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  collIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collBody: {
    flex: 1,
  },
  collAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  collSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  notesCard: {
    marginTop: spacing.md,
  },
  notesLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notesText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  actionBtn: {
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  modalDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  modalDateText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  modalSeg: {
    marginBottom: spacing.sm,
  },
  pickerDone: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-end',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalBtn: {
    flex: 1,
  },
});
