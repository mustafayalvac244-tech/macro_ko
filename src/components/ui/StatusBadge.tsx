import React from 'react';
import { Badge } from './Badge';
import { useTheme } from '@/theme/useTheme';
import { useT } from '@/i18n';
import type { CaseStatus, PriorityLevel } from '@/types/database';

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const __t = useTheme();
  const colors = __t.colors;
  const caseStatusColors = __t.caseStatusColors;

  const t = useT();
  const isClosed = status === 'closed' || status === 'won' || status === 'lost';
  const palette = caseStatusColors[status] ?? { fg: colors.textMuted, bg: colors.surfaceHover };
  return (
    <Badge
      label={t(isClosed ? 'caseFilter.closed' : 'caseFilter.open')}
      color={palette.fg}
      backgroundColor={palette.bg}
    />
  );
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const __t = useTheme();
  const colors = __t.colors;
  const priorityColors = __t.priorityColors;

  const t = useT();
  const color = priorityColors[priority] ?? colors.textMuted;
  return <Badge label={t(`priority.${priority}` as const)} color={color} backgroundColor={`${color}22`} />;
}
