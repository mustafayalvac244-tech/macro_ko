import React from 'react';
import { Badge } from './Badge';
import { caseStatusColors, colors, priorityColors } from '@/theme/theme';
import { titleCase } from '@/utils/format';
import type { CaseStatus, PriorityLevel } from '@/types/database';

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const palette = caseStatusColors[status] ?? { fg: colors.textMuted, bg: colors.surfaceHover };
  return <Badge label={titleCase(status)} color={palette.fg} backgroundColor={palette.bg} />;
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const color = priorityColors[priority] ?? colors.textMuted;
  return <Badge label={titleCase(priority)} color={color} backgroundColor={`${color}22`} />;
}
