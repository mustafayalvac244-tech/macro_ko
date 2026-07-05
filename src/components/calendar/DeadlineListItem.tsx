import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDateTime, isOverdue, relativeDueLabel } from '@/utils/format';
import type { Deadline, DeadlineWithCase } from '@/types/database';

interface DeadlineListItemProps {
  deadline: Deadline | DeadlineWithCase;
  onPress?: () => void;
  onToggleComplete?: () => void;
  showCase?: boolean;
}

export function DeadlineListItem({ deadline, onPress, onToggleComplete, showCase = true }: DeadlineListItemProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const priorityColors = __t.priorityColors;
  const styles = makeStyles(__t.colors);

  const overdue = !deadline.is_completed && isOverdue(deadline.due_at);
  const accent = deadline.is_completed ? colors.textMuted : priorityColors[deadline.priority] ?? colors.textMuted;
  const caseInfo = 'case' in deadline ? deadline.case : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Pressable onPress={onToggleComplete} hitSlop={8} style={styles.checkWrap}>
        <Ionicons
          name={deadline.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={deadline.is_completed ? colors.success : accent}
        />
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.title, deadline.is_completed && styles.titleDone]} numberOfLines={1}>
          {deadline.title}
        </Text>
        {showCase && caseInfo && (
          <Text style={styles.caseTitle} numberOfLines={1}>
            {caseInfo.title}
          </Text>
        )}
        <Text style={styles.meta} numberOfLines={1}>
          {formatDateTime(deadline.due_at)}
        </Text>
      </View>
      {!deadline.is_completed && (
        <View style={[styles.badge, overdue && styles.badgeOverdue]}>
          <Ionicons name={overdue ? 'alert-circle' : 'time-outline'} size={12} color={overdue ? colors.danger : colors.textSecondary} />
          <Text style={[styles.due, overdue && styles.dueOverdue]}>{relativeDueLabel(deadline.due_at)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  checkWrap: {
    marginRight: spacing.sm,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  badgeOverdue: {
    backgroundColor: colors.dangerSoft,
  },
  due: {
    ...typography.small,
    color: colors.textSecondary,
  },
  dueOverdue: {
    color: colors.danger,
  },
});
