export const colors = {
  // Base surfaces
  bg: '#080D17',
  bgElevated: '#0D1424',
  surface: '#121A2E',
  surfaceHover: '#1A2439',
  surfaceAlt: '#0F1729',
  border: '#243252',
  borderSubtle: '#1B2740',

  // Text
  textPrimary: '#EDF1F9',
  textSecondary: '#9AA6BC',
  textMuted: '#657089',
  textInverse: '#0A0F1C',

  // Brand
  primary: '#3B6FE0',
  primaryMuted: '#1E3A6B',
  primarySoft: 'rgba(59, 111, 224, 0.14)',
  gold: '#C9A24B',
  goldSoft: 'rgba(201, 162, 75, 0.14)',

  // Status
  success: '#33C481',
  successSoft: 'rgba(51, 196, 129, 0.14)',
  warning: '#E0A93B',
  warningSoft: 'rgba(224, 169, 59, 0.14)',
  danger: '#E5555C',
  dangerSoft: 'rgba(229, 85, 92, 0.14)',
  info: '#3B9DE0',
  infoSoft: 'rgba(59, 157, 224, 0.14)',

  overlay: 'rgba(4, 7, 14, 0.72)',
  transparent: 'transparent',
} as const;

export const caseStatusColors: Record<string, { fg: string; bg: string }> = {
  active: { fg: colors.info, bg: colors.infoSoft },
  pending: { fg: colors.warning, bg: colors.warningSoft },
  on_hold: { fg: colors.gold, bg: colors.goldSoft },
  closed: { fg: colors.textMuted, bg: 'rgba(101, 112, 137, 0.14)' },
  won: { fg: colors.success, bg: colors.successSoft },
  lost: { fg: colors.danger, bg: colors.dangerSoft },
};

export const priorityColors: Record<string, string> = {
  low: colors.textMuted,
  medium: colors.info,
  high: colors.warning,
  critical: colors.danger,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

export const theme = { colors, spacing, radius, typography, shadow, caseStatusColors, priorityColors };

export type Theme = typeof theme;
