import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { CaseStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { HearingListItem } from '@/components/calendar/HearingListItem';
import { DeadlineListItem } from '@/components/calendar/DeadlineListItem';
import { DocumentListItem } from '@/components/documents/DocumentListItem';
import { Input } from '@/components/ui/Input';
import { useCase, useDeleteCase } from '@/hooks/useCases';
import { useHearingsForCase } from '@/hooks/useHearings';
import { useDeadlinesForCase, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useDocuments, useSignedDocumentUrl } from '@/hooks/useDocuments';
import { useCreatePayment, useDeletePayment, usePaymentsForCase } from '@/hooks/usePayments';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDate, formatMoney } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentCategory } from '@/types/database';

type Tab = 'overview' | 'hearings' | 'deadlines' | 'documents' | 'finance';

export default function CaseDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: caseItem, isLoading } = useCase(id);
  const hearings = useHearingsForCase(id);
  const deadlines = useDeadlinesForCase(id);
  const documents = useDocuments(id);
  const payments = usePaymentsForCase(id);
  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();
  const updateDeadline = useUpdateDeadline();
  const deleteCase = useDeleteCase();
  const signedUrl = useSignedDocumentUrl();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  if (isLoading || !caseItem) {
    return (
      <Screen>
        <ScreenHeader title={t('case.title')} showBack />
      </Screen>
    );
  }

  const handleDelete = () => {
    Alert.alert(t('case.delete'), t('case.deleteConfirm', { title: caseItem.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCase.mutateAsync(caseItem.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={caseItem.title}
        subtitle={caseItem.case_number ? `#${caseItem.case_number}` : undefined}
        showBack
        rightIcon="create-outline"
        onRightPress={() => router.push(`/case-form?id=${caseItem.id}`)}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <View style={styles.badgeRow}>
            <CaseStatusBadge status={caseItem.status} />
            <PriorityBadge priority={caseItem.priority} />
          </View>

          {caseItem.client && (
            <InfoRow
              label={t('case.client')}
              value={caseItem.client.full_name}
              onPress={() => router.push(`/(app)/clients/${caseItem.client!.id}`)}
            />
          )}
          {caseItem.court_name && <InfoRow label={t('case.court')} value={caseItem.court_name} />}
          {caseItem.case_type && <InfoRow label={t('case.caseType')} value={caseItem.case_type} />}
          {caseItem.opposing_party && <InfoRow label={t('case.opposingParty')} value={caseItem.opposing_party} />}
          <InfoRow label={t('case.opened')} value={formatDate(caseItem.opened_date)} />
          {caseItem.closed_date && <InfoRow label={t('case.closed')} value={formatDate(caseItem.closed_date)} />}
        </Card>

        <View style={styles.tabsWrap}>
          <SegmentedControl
            options={[
              { label: t('case.tabOverview'), value: 'overview' },
              { label: t('case.tabHearings'), value: 'hearings' },
              { label: t('case.tabDeadlines'), value: 'deadlines' },
              { label: t('case.tabDocuments'), value: 'documents' },
              { label: t('case.tabFinance'), value: 'finance' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'overview' && (
          <Card>
            <Text style={styles.sectionLabel}>{t('case.description')}</Text>
            <Text style={styles.description}>{caseItem.description || t('case.noDescription')}</Text>
          </Card>
        )}

        {tab === 'hearings' && (
          <View>
            <SectionHeader title={t('case.tabHearings')} actionLabel={t('case.add')} onAction={() => router.push(`/hearing-form?caseId=${caseItem.id}`)} />
            <Card>
              {hearings.data && hearings.data.length > 0 ? (
                hearings.data.map((hearing, index) => (
                  <View key={hearing.id} style={index > 0 ? styles.divider : undefined}>
                    <HearingListItem
                      hearing={hearing}
                      showCase={false}
                      onPress={() => router.push(`/hearing-form?caseId=${caseItem.id}&id=${hearing.id}`)}
                    />
                  </View>
                ))
              ) : (
                <EmptyState icon="hammer-outline" title={t('case.noHearings')} />
              )}
            </Card>
          </View>
        )}

        {tab === 'deadlines' && (
          <View>
            <SectionHeader title={t('case.tabDeadlines')} actionLabel={t('case.add')} onAction={() => router.push(`/deadline-form?caseId=${caseItem.id}`)} />
            <Card>
              {deadlines.data && deadlines.data.length > 0 ? (
                deadlines.data.map((deadline, index) => (
                  <View key={deadline.id} style={index > 0 ? styles.divider : undefined}>
                    <DeadlineListItem
                      deadline={deadline}
                      showCase={false}
                      onPress={() => router.push(`/deadline-form?caseId=${caseItem.id}&id=${deadline.id}`)}
                      onToggleComplete={() =>
                        updateDeadline.mutate({
                          id: deadline.id,
                          is_completed: !deadline.is_completed,
                          caseTitle: caseItem.title,
                        })
                      }
                    />
                  </View>
                ))
              ) : (
                <EmptyState icon="alert-circle-outline" title={t('case.noDeadlines')} />
              )}
            </Card>
          </View>
        )}

        {tab === 'documents' && (
          <View>
            <SectionHeader title={t('case.tabDocuments')} actionLabel={t('case.upload')} onAction={() => router.push(`/document-upload?caseId=${caseItem.id}`)} />
            {documents.data && documents.data.length > 0 ? (
              (() => {
                const groups = new Map<DocumentCategory, typeof documents.data>();
                documents.data!.forEach((doc) => {
                  const list = groups.get(doc.category) ?? [];
                  list.push(doc);
                  groups.set(doc.category, list);
                });
                return Array.from(groups.entries()).map(([category, docs]) => (
                  <View key={category} style={styles.folderGroup}>
                    <View style={styles.folderHeader}>
                      <Ionicons name="folder" size={16} color={colors.gold} />
                      <Text style={styles.folderTitle}>{t(`docCategory.${category}` as const)}</Text>
                      <Text style={styles.folderCount}>{docs.length}</Text>
                    </View>
                    <Card>
                      {docs.map((doc, index) => (
                        <View key={doc.id} style={index > 0 ? styles.divider : undefined}>
                          <DocumentListItem
                            document={doc}
                            onPress={async () => {
                              const url = await signedUrl.mutateAsync(doc.file_path);
                              Linking.openURL(url);
                            }}
                          />
                        </View>
                      ))}
                    </Card>
                  </View>
                ));
              })()
            ) : (
              <Card>
                <EmptyState icon="folder-open-outline" title={t('case.noDocuments')} />
              </Card>
            )}
          </View>
        )}

        {tab === 'finance' && (
          <View>
            <Card style={styles.financeSummary}>
              <View style={styles.financeRow}>
                <FinanceStat
                  label={t('finance.fee')}
                  value={caseItem.fee_amount != null ? formatMoney(caseItem.fee_amount) : t('finance.noFee')}
                  color={colors.textPrimary}
                />
                <FinanceStat
                  label={t('finance.collected')}
                  value={formatMoney((payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0))}
                  color={colors.success}
                />
                <FinanceStat
                  label={t('finance.remaining')}
                  value={
                    caseItem.fee_amount != null
                      ? formatMoney(
                          Math.max(0, Number(caseItem.fee_amount) - (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0))
                        )
                      : '—'
                  }
                  color={colors.warning}
                />
              </View>
            </Card>

            <Card style={styles.paymentForm}>
              <Input
                label={t('finance.amount')}
                placeholder={t('finance.amountPlaceholder')}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
              <Input
                label={t('finance.note')}
                placeholder={t('finance.notePlaceholder')}
                value={paymentNote}
                onChangeText={setPaymentNote}
              />
              <Button
                label={t('finance.addPayment')}
                icon="cash-outline"
                loading={createPayment.isPending}
                disabled={!paymentAmount.trim() || !(Number(paymentAmount.replace(',', '.')) > 0)}
                onPress={async () => {
                  await createPayment.mutateAsync({
                    case_id: caseItem.id,
                    amount: Number(paymentAmount.replace(',', '.')),
                    note: paymentNote.trim() || null,
                  });
                  setPaymentAmount('');
                  setPaymentNote('');
                }}
                fullWidth
              />
            </Card>

            <SectionHeader title={t('finance.payments')} />
            <Card>
              {payments.data && payments.data.length > 0 ? (
                payments.data.map((payment, index) => (
                  <View key={payment.id} style={index > 0 ? styles.divider : undefined}>
                    <View style={styles.paymentRow}>
                      <View style={styles.paymentIcon}>
                        <Ionicons name="cash-outline" size={16} color={colors.success} />
                      </View>
                      <View style={styles.paymentBody}>
                        <Text style={styles.paymentAmount}>{formatMoney(Number(payment.amount))}</Text>
                        <Text style={styles.paymentMeta}>
                          {formatDate(payment.paid_at)}
                          {payment.note ? ` · ${payment.note}` : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.textMuted}
                        suppressHighlighting
                        onPress={() =>
                          Alert.alert(t('finance.deleteTitle'), t('finance.deleteConfirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('common.delete'), style: 'destructive', onPress: () => deletePayment.mutate(payment.id) },
                          ])
                        }
                      />
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState icon="cash-outline" title={t('finance.noPayments')} />
              )}
            </Card>
          </View>
        )}

        <Button label={t('case.delete')} variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>
    </Screen>
  );
}

function FinanceStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.financeStat}>
      <Text style={styles.financeStatLabel}>{label}</Text>
      <Text style={[styles.financeStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]} onPress={onPress} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  infoValueLink: {
    color: colors.primary,
  },
  tabsWrap: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  deleteButton: {
    marginTop: spacing.xl,
  },
  folderGroup: {
    marginBottom: spacing.md,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  folderTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  folderCount: {
    ...typography.small,
    color: colors.textMuted,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  financeSummary: {
    marginBottom: spacing.md,
  },
  financeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  financeStat: {
    flex: 1,
    alignItems: 'center',
  },
  financeStatLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  financeStatValue: {
    ...typography.h3,
  },
  paymentForm: {
    marginBottom: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  paymentBody: {
    flex: 1,
  },
  paymentAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  paymentMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
});
