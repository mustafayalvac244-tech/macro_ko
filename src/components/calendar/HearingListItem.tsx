import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { formatDateTime, relativeDueLabel, isOverdue } from '@/utils/format';
import { titleCase } from '@/utils/format';
import type { Hearing, HearingWithCase } from '@/types/database';

const HEARING_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  hearing: 'hammer-outline',
  trial: 'hammer-outline',
  mediation: 'people-outline',
  deposition: 'document-text-outline',
  filing: 'file-tray-full-outline',
  meeting: 'chatbubbles-outline',
  other: 'time-outline',
};

interface HearingListItemProps {
  hearing: Hearing | HearingWithCase;
  onPress?: () => void;
  showCase?: boolean;
}

export function HearingListItem({ hearing, onPress, showCase = true }: HearingListItemProps) {
  const overdue = !hearing.is_completed && isOverdue(hearing.scheduled_at);
  const caseInfo = 'case' in hearing ? hearing.case : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, overdue && styles.iconWrapOverdue]}>
        <Ionicons name={HEARING_ICONS[hearing.type] ?? 'time-outline'} size={18} color={overdue ? colors.danger : colors.info} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {hearing.title}
        </Text>
        {showCase && caseInfo && (
          <Text style={styles.caseTitle} numberOfLines={1}>
            {caseInfo.title}
          </Text>
        )}
        <Text style={styles.meta} numberOfLines={1}>
          {titleCase(hearing.type)} · {formatDateTime(hearing.scheduled_at)}
        </Text>
      </View>
      <Text style={[styles.due, overdue && styles.dueOverdue]}>{relativeDueLabel(hearing.scheduled_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconWrapOverdue: {
    backgroundColor: colors.dangerSoft,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  caseTitle: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  due: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    maxWidth: 90,
    textAlign: 'right',
  },
  dueOverdue: {
    color: colors.danger,
  },
});
