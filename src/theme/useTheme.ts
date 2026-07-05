import { useMemo } from 'react';
import { useThemeStore } from './themeStore';
import {
  caseStatusColorsFor,
  palettes,
  priorityColorsFor,
  themeMetas,
  type ThemeColors,
  type ThemeId,
} from './palettes';
import { radius, shadow, spacing, typography } from './tokens';

export interface Theme {
  colors: ThemeColors;
  caseStatusColors: Record<string, { fg: string; bg: string }>;
  priorityColors: Record<string, string>;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: typeof shadow;
  themeId: ThemeId;
  statusBar: 'light' | 'dark';
}

/**
 * Reactive theme hook — every component that calls this re-renders when the
 * active theme changes, so styles recomputed from `colors` update live.
 */
export function useTheme(): Theme {
  const themeId = useThemeStore((s) => s.themeId);

  return useMemo(() => {
    const colors = palettes[themeId];
    const meta = themeMetas.find((m) => m.id === themeId) ?? themeMetas[0]!;
    return {
      colors,
      caseStatusColors: caseStatusColorsFor(colors),
      priorityColors: priorityColorsFor(colors),
      spacing,
      radius,
      typography,
      shadow,
      themeId,
      statusBar: meta.statusBar,
    };
  }, [themeId]);
}
