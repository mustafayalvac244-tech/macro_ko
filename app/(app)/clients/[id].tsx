import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function ClientDetailScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCasesByClient(id);
  const deleteClient = useDeleteClient();

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
  deleteButton: {
    marginTop: spacing.xl,
  },
});
