import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CaseListItem } from '@/components/cases/CaseListItem';
import { useClient, useDeleteClient } from '@/hooks/useClients';
import { useCasesByClient } from '@/hooks/useCases';
import {
  isMissingPromiseTable,
  useDeletePromise,
  usePromisesForClient,
  useTogglePromisePaid,
} from '@/hooks/usePaymentPromises';
import {
  isMissingAdvanceTable,
  useClientAdvances,
  useClientExpensesTotal,
  useCreateClientAdvance,
  useDeleteClientAdvance,
} from '@/hooks/useClientAdvances';
import { useEnforcementsByClient } from '@/hooks/useEnforcements';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney, relativeDueLabel, isOverdue } from '@/utils/format';
import type { PaymentPromise } from '@/types/database';

/** Aynı taksit planına (group_id) ait sözleri tek blokta toplar; tekil sözler ayrı kalır. */
function groupPromises(list: PaymentPromise[]): { key: string; items: PaymentPromise[] }[] {
  const groups: { key: string; items: PaymentPromise[] }[] = [];
  const indexByGroup: Record<string, number> = {};
  list.forEach((p) => {
    if (p.group_id) {
      if (indexByGroup[p.group_id] === undefined) {
        indexByGroup[p.group_id] = groups.length;
        groups.push({ key: p.group_id, items: [] });
      }
      groups[indexByGroup[p.group_id]]!.items.push(p);
    } else {
      groups.push({ key: p.id, items: [p] });
    }
  });
  groups.forEach((g) => g.items.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)));
  return groups;
}

export default function ClientDetailScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCasesByClient(id);
  const deleteClient = useDeleteClient();
  const promises = usePromisesForClient(id);
  const togglePaid = useTogglePromisePaid();
  const deletePromise = useDeletePromise();

  const clientEnfs = useEnforcementsByClient(id);

  // Masraf avansı: yatırılan avanslar − davalardaki harcamalar = kalan bakiye
  const advances = useClientAdvances(id);
  const expensesTotal = useClientExpensesTotal(id);
  const createAdvance = useCreateClientAdvance();
  const deleteAdvance = useDeleteClientAdvance();
  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  const advanceSummary = useMemo(() => {
    const deposited = (advances.data ?? []).reduce((s, a) => s + Number(a.amount), 0);
    const spent = expensesTotal.data ?? 0;
    return { deposited, spent, balance: deposited - spent };
  }, [advances.data, expensesTotal.data]);

  const submitAdvance = async () => {
    const amount = Number(advanceAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await createAdvance.mutateAsync({ client_id: id, amount, note: advanceNote.trim() || null });
      setAdvanceModal(false);
      setAdvanceAmount('');
      setAdvanceNote('');
    } catch (e) {
      Alert.alert(
        t('advance.title'),
        isMissingAdvanceTable(e) ? t('advance.setupRequired') : (e as Error).message ?? 'Error'
      );
    }
  };

  // Alacak özeti doğrudan alttaki listeden hesaplanır: eklenen her alacak
  // "Toplam"a, ödendi işaretlenen "Tahsil Edilen"e, kalanı "Kalan Alacak"a yansır.
  const summary = useMemo(() => {
    const list = promises.data ?? [];
    let total = 0;
    let collected = 0;
    for (const p of list) {
      const amt = Number(p.amount) || 0;
      total += amt;
      if (p.is_paid) collected += amt;
    }
    return { total, collected, remaining: Math.max(0, total - collected) };
  }, [promises.data]);

  if (isLoading || !client) {
    return (
      <Screen>
        <ScreenHeader title={t('client.title')} showBack />
      </Screen>
    );
  }

  const handleDelete = () => {
    Alert.alert(t('client.delete'), t('client.deleteConfirm', { name: client.full_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteClient.mutateAsync(client.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={client.full_name}
        showBack
        rightIcon="create-outline"
        onRightPress={() => router.push(`/client-form?id=${client.id}`)}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={client.full_name} size={56} />
            <View style={styles.profileBody}>
              <Text style={styles.name}>{client.full_name}</Text>
              {client.company && <Text style={styles.company}>{client.company}</Text>}
            </View>
          </View>

          {client.email && (
            <ContactRow
              icon="mail-outline"
              value={client.email}
              actionIcon="send"
              onPress={() => Linking.openURL(`mailto:${client.email}`).catch(() => {})}
            />
          )}
          {client.phone && (
            <ContactRow
              icon="call-outline"
              value={client.phone}
              actionIcon="call"
              onPress={() => Linking.openURL(`tel:${client.phone!.replace(/[^+\d]/g, '')}`).catch(() => {})}
            />
          )}
          {client.address && <ContactRow icon="location-outline" value={client.address} />}
        </Card>

        {client.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionLabel}>{t('client.notes')}</Text>
            <Text style={styles.notes}>{client.notes}</Text>
          </Card>
        )}

        {/* Receivables: how much is owed and when it will be paid */}
        <SectionHeader
          title={t('promise.section')}
          actionLabel={t('promise.add')}
          onAction={() =>
            router.push(
              `/promise-form?clientId=${client.id}&clientName=${encodeURIComponent(client.full_name)}` as Parameters<typeof router.push>[0]
            )
          }
        />
        <Card style={styles.financeCard}>
          <View style={styles.financeRow}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>{t('promise.total')}</Text>
              <Text style={styles.financeValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(summary.total)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>{t('finance.collected')}</Text>
              <Text style={[styles.financeValue, { color: __t.colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(summary.collected)}
              </Text>
            </View>
            <View style={[styles.financeItem, styles.financeItemHighlight]}>
              <Text style={styles.financeLabel}>{t('promise.remaining')}</Text>
              <Text style={[styles.financeValue, { color: __t.colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(summary.remaining)}
              </Text>
            </View>
          </View>

          {promises.error && isMissingPromiseTable(promises.error) && (
            <Text style={styles.setupNote}>{t('promise.setupRequired')}</Text>
          )}

          <View style={styles.howToRow}>
            <Ionicons name="information-circle-outline" size={14} color={__t.colors.info} />
            <Text style={styles.howToText}>{t('promise.howto')}</Text>
          </View>

          {groupPromises(promises.data ?? []).map((group) => {
            const renderRow = (p: PaymentPromise) => {
              const overdue = !p.is_paid && isOverdue(`${p.due_date}T23:59:59`);
              return (
                <View key={p.id} style={styles.promiseRow}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => togglePaid.mutate({ promise: p, clientName: client.full_name })}
                  >
                    <Ionicons
                      name={p.is_paid ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={p.is_paid ? __t.colors.success : __t.colors.textMuted}
                    />
                  </Pressable>
                  <View style={styles.promiseBody}>
                    <Text style={[styles.promiseAmount, p.is_paid && styles.promisePaid]}>
                      {p.seq ? `${t('promise.seqShort', { seq: p.seq })} · ` : ''}
                      {formatMoney(Number(p.amount))}
                    </Text>
                    <Text
                      style={[
                        styles.promiseDue,
                        overdue && { color: __t.colors.danger, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {formatDate(`${p.due_date}T12:00:00`)}
                      {!p.is_paid && ` · ${relativeDueLabel(`${p.due_date}T09:00:00`)}`}
                      {p.is_paid && ` · ${t('promise.paid')}`}
                    </Text>
                    {p.note && !p.group_id && (
                      <Text style={styles.promiseNote} numberOfLines={1}>
                        {p.note}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      Alert.alert(t('promise.deleteTitle'), formatMoney(Number(p.amount)), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => deletePromise.mutate(p.id) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={__t.colors.textMuted} />
                  </Pressable>
                </View>
              );
            };

            if (group.items.length === 1 && !group.items[0]!.group_id) {
              return renderRow(group.items[0]!);
            }

            // Taksitli plan: başlık + ilerleme çubuğu + taksit satırları
            const total = group.items.reduce((s, p) => s + Number(p.amount), 0);
            const paidAmount = group.items.filter((p) => p.is_paid).reduce((s, p) => s + Number(p.amount), 0);
            const paidCount = group.items.filter((p) => p.is_paid).length;
            const pct = total > 0 ? Math.round((paidAmount / total) * 100) : 0;
            return (
              <View key={group.key} style={styles.groupWrap}>
                <View style={styles.groupHead}>
                  <Ionicons name="layers-outline" size={15} color={__t.colors.primary} />
                  <Text style={styles.groupTitle}>
                    {t('promise.groupTitle', { n: group.items[0]!.total_count ?? group.items.length })}
                  </Text>
                  <Text style={styles.groupTotal}>{formatMoney(total)}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.groupMetaRow}>
                  <Text style={[styles.groupMeta, { color: __t.colors.success }]}>
                    {t('promise.groupProgress', { paid: paidCount, n: group.items.length })}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {t('promise.groupRemaining', { amount: formatMoney(Math.max(0, total - paidAmount)) })}
                  </Text>
                </View>
                {!!group.items[0]!.note && (
                  <Text style={styles.promiseNote} numberOfLines={1}>
                    {group.items[0]!.note}
                  </Text>
                )}
                {group.items.map(renderRow)}
              </View>
            );
          })}

          {!promises.error && (promises.data ?? []).length === 0 && (
            <Text style={styles.promiseEmpty}>{t('promise.empty')}</Text>
          )}
        </Card>

        {/* Masraf avansı: yatırılan avans, davalardaki harcama ile düşer */}
        <SectionHeader
          title={t('advance.section')}
          actionLabel={t('advance.add')}
          onAction={() => setAdvanceModal(true)}
        />
        <Card style={styles.financeCard}>
          <View style={styles.financeRow}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>{t('advance.deposited')}</Text>
              <Text style={styles.financeValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(advanceSummary.deposited)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>{t('advance.spent')}</Text>
              <Text style={[styles.financeValue, { color: __t.colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(advanceSummary.spent)}
              </Text>
            </View>
            <View
              style={[
                styles.financeItem,
                advanceSummary.balance < 0 ? styles.financeItemHighlight : styles.financeItemOk,
              ]}
            >
              <Text style={styles.financeLabel}>{t('advance.balance')}</Text>
              <Text
                style={[
                  styles.financeValue,
                  { color: advanceSummary.balance < 0 ? __t.colors.danger : __t.colors.success },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(advanceSummary.balance)}
              </Text>
            </View>
          </View>

          {advances.error && isMissingAdvanceTable(advances.error) && (
            <Text style={styles.setupNote}>{t('advance.setupRequired')}</Text>
          )}

          {advanceSummary.balance < 0 ? (
            <View style={styles.warnRow}>
              <Ionicons name="alert-circle" size={16} color={__t.colors.danger} />
              <Text style={styles.warnText}>
                {t('advance.negativeWarn', { amount: formatMoney(Math.abs(advanceSummary.balance)) })}
              </Text>
            </View>
          ) : (
            <View style={styles.howToRow}>
              <Ionicons name="information-circle-outline" size={14} color={__t.colors.info} />
              <Text style={styles.howToText}>{t('advance.howto')}</Text>
            </View>
          )}

          {(advances.data ?? []).map((a) => (
            <View key={a.id} style={styles.promiseRow}>
              <View style={styles.advanceIcon}>
                <Ionicons name="wallet-outline" size={16} color={__t.colors.success} />
              </View>
              <View style={styles.promiseBody}>
                <Text style={styles.promiseAmount}>{formatMoney(Number(a.amount))}</Text>
                <Text style={styles.promiseDue} numberOfLines={1}>
                  {formatDate(a.deposited_at)}
                  {a.note ? ` · ${a.note}` : ''}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(t('advance.deleteTitle'), formatMoney(Number(a.amount)), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => deleteAdvance.mutate(a.id) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color={__t.colors.textMuted} />
              </Pressable>
            </View>
          ))}

          {!advances.error && (advances.data ?? []).length === 0 && (
            <Text style={styles.promiseEmpty}>{t('advance.empty')}</Text>
          )}
        </Card>

        <SectionHeader
          title={t('client.linkedCases')}
          actionLabel={t('dash.newCase')}
          onAction={() => router.push(`/case-form?clientId=${client.id}`)}
        />
        <Card>
          {cases && cases.length > 0 ? (
            <View>
              {cases.map((c) => (
                <View key={c.id} style={styles.caseWrap}>
                  <CaseListItem
                    caseItem={{ ...c, client: { id: client.id, full_name: client.full_name, company: client.company } }}
                    onPress={() => router.push(`/(app)/cases/${c.id}`)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState icon="briefcase-outline" title={t('client.noCases')} description={t('client.noCasesDesc')} />
          )}
        </Card>

        {/* İcra dosyaları (alacaklı = bu müvekkil) */}
        <SectionHeader
          title={t('enf.clientSection')}
          actionLabel={t('enf.new')}
          onAction={() => router.push(`/enforcement-form?clientId=${client.id}` as Parameters<typeof router.push>[0])}
        />
        <Card padded={false}>
          {(clientEnfs.data ?? []).length > 0 ? (
            (clientEnfs.data ?? []).map((e, i) => (
              <Pressable
                key={e.id}
                style={[styles.enfRow, i > 0 && styles.enfDivider]}
                onPress={() => router.push(`/enforcement/${e.id}` as Parameters<typeof router.push>[0])}
              >
                <View style={styles.enfIcon}>
                  <Ionicons name="hammer-outline" size={16} color={__t.colors.warning} />
                </View>
                <View style={styles.promiseBody}>
                  <Text style={styles.promiseAmount} numberOfLines={1}>
                    {e.debtor_name}
                  </Text>
                  <Text style={styles.promiseDue} numberOfLines={1}>
                    {[e.file_number, t(`enf.stage.${e.stage}` as const)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={__t.colors.textMuted} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.promiseEmpty}>{t('enf.empty')}</Text>
          )}
        </Card>

        <Button label={t('client.delete')} variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>

      {/* Masraf avansı ekleme */}
      <Modal visible={advanceModal} transparent animationType="fade" onRequestClose={() => setAdvanceModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAdvanceModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('advance.add')}</Text>
            <Text style={styles.modalSub}>{t('advance.addSub')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('advance.amountPlaceholder')}
              placeholderTextColor={__t.colors.textMuted}
              keyboardType="decimal-pad"
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('advance.notePlaceholder')}
              placeholderTextColor={__t.colors.textMuted}
              value={advanceNote}
              onChangeText={setAdvanceNote}
            />
            <View style={styles.modalActions}>
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setAdvanceModal(false)} style={styles.modalBtn} />
              <Button
                label={t('common.save')}
                onPress={submitAdvance}
                loading={createAdvance.isPending}
                disabled={!advanceAmount.trim()}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function ContactRow({
  icon,
  value,
  onPress,
  actionIcon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const content = (
    <>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.contactValue} numberOfLines={1}>
        {value}
      </Text>
      {onPress && actionIcon && (
        <View style={styles.contactAction}>
          <Ionicons name={actionIcon} size={14} color={colors.success} />
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.contactRow} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.contactRow}>{content}</View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileBody: {
    marginLeft: spacing.sm,
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  company: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
  },
  contactValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  contactAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesCard: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notes: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  caseWrap: {
    marginBottom: spacing.xs,
  },
  financeCard: {
    marginBottom: spacing.md,
  },
  financeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  financeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  financeItemHighlight: {
    backgroundColor: colors.dangerSoft,
  },
  financeItemOk: {
    backgroundColor: colors.successSoft,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.xs,
  },
  warnText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
    lineHeight: 16,
    fontWeight: '700',
  },
  advanceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  enfDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  enfIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  modalSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
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
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalBtn: {
    flex: 1,
  },
  financeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  financeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  setupNote: {
    ...typography.small,
    color: colors.warning,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: colors.infoSoft,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    marginBottom: spacing.xs,
  },
  howToText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  groupWrap: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  groupTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  groupTotal: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
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
  groupMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  groupMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  promiseBody: {
    flex: 1,
  },
  promiseAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  promisePaid: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  promiseDue: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  promiseNote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  promiseEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.xl,
  },
});
