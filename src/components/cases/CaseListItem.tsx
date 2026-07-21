import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CaseStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';
import { useT } from '@/i18n';
import type { CaseWithClient, PriorityLevel } from '@/types/database';

interface CaseListItemProps {
  caseItem: CaseWithClient;
  onPress: () => void;
}

export function CaseListItem({ caseItem, onPress }: CaseListItemProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  // Sol vurgu çizgisi ve ikon rengi öncelik/duruma göre — listeye canlılık katar.
  const priorityColor: Record<PriorityLevel, string> = {
    critical: colors.danger,
    high: colors.warning,
    medium: colors.info,
    low: colors.textMuted,
  };
  const closed = ['closed', 'won', 'lost'].includes(caseItem.status);
  const accent = closed ? colors.textMuted : priorityColor[caseItem.priority];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={[styles.icon, { backgroundColor: colors.goldSoft, borderColor: colors.border }]}>
        <Ionicons name={closed ? 'briefcase-outline' : 'briefcase'} size={20} color={colors.gold} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {caseItem.title}
          </Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        </View>

        {caseItem.client && (
          <Text style={styles.client} numberOfLines={1}>
            {caseItem.client.full_name}
            {caseItem.client.company ? ` · ${caseItem.client.company}` : ''}
          </Text>
        )}

        <View style={styles.metaRow}>
          {caseItem.case_number ? (
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={11} color={colors.textMuted} />
              <Text style={styles.meta}>{caseItem.case_number}</Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
            <Text style={styles.meta}>{formatDate(caseItem.opened_date)}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <CaseStatusBadge status={caseItem.status} />
          <PriorityBadge priority={caseItem.priority} />
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: spacing.md + 4,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  client: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
