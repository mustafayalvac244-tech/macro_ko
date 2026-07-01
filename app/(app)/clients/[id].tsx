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
import { colors, spacing, typography } from '@/theme/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCasesByClient(id);
  const deleteClient = useDeleteClient();

  if (isLoading || !client) {
    return (
      <Screen>
        <ScreenHeader title="Client" showBack />
      </Screen>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete Client', `Delete "${client.full_name}"? Linked cases will remain but unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
      <ScreenHeader title={client.full_name} showBack rightIcon="create-outline" onRightPress={() => router.push(`/client-form?id=${client.id}`)} />

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
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{client.notes}</Text>
          </Card>
        )}

        <SectionHeader
          title="Linked Cases"
          actionLabel="New Case"
          onAction={() => router.push(`/case-form?clientId=${client.id}`)}
        />
        <Card>
          {cases && cases.length > 0 ? (
            <View>
              {cases.map((c) => (
                <View key={c.id} style={styles.caseWrap}>
                  <CaseListItem caseItem={{ ...c, client: { id: client.id, full_name: client.full_name, company: client.company } }} onPress={() => router.push(`/(app)/cases/${c.id}`)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState icon="briefcase-outline" title="No cases linked" description="Cases for this client will appear here." />
          )}
        </Card>

        <Button label="Delete Client" variant="danger" onPress={handleDelete} style={styles.deleteButton} />
      </ScrollView>
    </Screen>
  );
}

function ContactRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.contactValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
