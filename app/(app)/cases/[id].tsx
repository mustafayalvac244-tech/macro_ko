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
import { useCase, useDeleteCase } from '@/hooks/useCases';
import { useHearingsForCase } from '@/hooks/useHearings';
import { useDeadlinesForCase, useUpdateDeadline } from '@/hooks/useDeadlines';
import { useDocuments, useSignedDocumentUrl } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDate } from '@/utils/format';

type Tab = 'overview' | 'hearings' | 'deadlines' | 'documents';

export default function CaseDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: caseItem, isLoading } = useCase(id);
  const hearings = useHearingsForCase(id);
  const deadlines = useDeadlinesForCase(id);
  const documents = useDocuments(id);
  const updateDeadline = useUpdateDeadline();
  const deleteCase = useDeleteCase();
  const signedUrl = useSignedDocumentUrl();

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
            <Card>
              {documents.data && documents.data.length > 0 ? (
                documents.data.map((doc, index) => (
                  <View key={doc.id} style={index > 0 ? styles.divider : undefined}>
                    <DocumentListItem
                      document={doc}
                      onPress={async () => {
                        const url = await signedUrl.mutateAsync(doc.file_path);
                        Linking.openURL(url);
                      }}
                    />
                  </View>
                ))
              ) : (
                <EmptyState icon="folder-open-outline" title={t('case.noDocuments')} />
              )}
            </Card>
          </View>
        )}

        <Button label={t('case.delete')} variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>
    </Screen>
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
});
