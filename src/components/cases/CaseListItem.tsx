import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { CaseStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDate } from '@/utils/format';
import type { CaseWithClient } from '@/types/database';

interface CaseListItemProps {
  caseItem: CaseWithClient;
  onPress: () => void;
}

export function CaseListItem({ caseItem, onPress }: CaseListItemProps) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {caseItem.title}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {caseItem.client && (
        <Text style={styles.client} numberOfLines={1}>
          {caseItem.client.full_name}
          {caseItem.client.company ? ` · ${caseItem.client.company}` : ''}
        </Text>
      )}

      <View style={styles.metaRow}>
        {caseItem.case_number && <Text style={styles.meta}>#{caseItem.case_number}</Text>}
        <Text style={styles.meta}>Opened {formatDate(caseItem.opened_date)}</Text>
      </View>

      <View style={styles.badgeRow}>
        <CaseStatusBadge status={caseItem.status} />
        <PriorityBadge priority={caseItem.priority} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.xs,
  },
  client: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'none',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
