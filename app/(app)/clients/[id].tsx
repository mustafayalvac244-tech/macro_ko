import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  useClientFinance,
  useDeletePromise,
  usePromisesForClient,
  useTogglePromisePaid,
} from '@/hooks/usePaymentPromises';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney, relativeDueLabel, isOverdue } from '@/utils/format';

export default function ClientDetailScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCasesByClient(id);
  const deleteClient = useDeleteClient();
  const finance = useClientFinance(id);
  const promises = usePromisesForClient(id);
  const togglePaid = useTogglePromisePaid();
  const deletePromise = useDeletePromise();

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

          {client.email && <ContactRow icon="mail-outline" value={client.email} />}
          {client.phone && <ContactRow icon="call-outline" value={client.phone} />}
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
              <Text style={styles.financeLabel}>{t('finance.fee')}</Text>
              <Text style={styles.financeValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(finance.data?.totalFee ?? 0)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>{t('finance.collected')}</Text>
              <Text style={[styles.financeValue, { color: __t.colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(finance.data?.collected ?? 0)}
              </Text>
            </View>
            <View style={[styles.financeItem, styles.financeItemHighlight]}>
              <Text style={styles.financeLabel}>{t('promise.remaining')}</Text>
              <Text style={[styles.financeValue, { color: __t.colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(finance.data?.remaining ?? 0)}
              </Text>
            </View>
          </View>

          {promises.error && isMissingPromiseTable(promises.error) && (
            <Text style={styles.setupNote}>{t('promise.setupRequired')}</Text>
          )}

          {(promises.data ?? []).map((p) => {
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
                  {p.note && (
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
          })}

          {!promises.error && (promises.data ?? []).length === 0 && (
            <Text style={styles.promiseEmpty}>{t('promise.empty')}</Text>
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

        <Button label={t('client.delete')} variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>
    </Screen>
  );
}

function ContactRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.contactValue}>{value}</Text>
    </View>
  );
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
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
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
