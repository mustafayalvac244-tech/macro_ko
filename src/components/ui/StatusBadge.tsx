import React from 'react';
import { Badge } from './Badge';
import { caseStatusColors, colors, priorityColors } from '@/theme/theme';
import { useT } from '@/i18n';
import type { CaseStatus, PriorityLevel } from '@/types/database';

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const t = useT();
  const palette = caseStatusColors[status] ?? { fg: colors.textMuted, bg: colors.surfaceHover };
  return <Badge label={t(`status.${status}` as const)} color={palette.fg} backgroundColor={palette.bg} />;
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const t = useT();
  const color = priorityColors[priority] ?? colors.textMuted;
  return <Badge label={t(`priority.${priority}` as const)} color={color} backgroundColor={`${color}22`} />;
}
