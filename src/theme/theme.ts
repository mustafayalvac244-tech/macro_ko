export const colors = {
  // Base surfaces (light, cool-grey professional)
  bg: '#F4F6FA',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHover: '#EEF1F7',
  surfaceAlt: '#F1F4F9',
  border: '#D7DEEA',
  borderSubtle: '#E7EBF3',

  // Text (navy ink)
  textPrimary: '#16203A',
  textSecondary: '#4E5A74',
  textMuted: '#8A94AB',
  textInverse: '#FFFFFF',

  // Brand
  primary: '#1E4B9E',
  primaryMuted: '#DCE6F7',
  primarySoft: 'rgba(30, 75, 158, 0.10)',
  gold: '#A87F2E',
  goldSoft: 'rgba(168, 127, 46, 0.12)',

  // Status
  success: '#1B9E63',
  successSoft: 'rgba(27, 158, 99, 0.12)',
  warning: '#B97E14',
  warningSoft: 'rgba(185, 126, 20, 0.12)',
  danger: '#D23B42',
  dangerSoft: 'rgba(210, 59, 66, 0.12)',
  info: '#1F74C0',
  infoSoft: 'rgba(31, 116, 192, 0.12)',

  overlay: 'rgba(10, 17, 34, 0.45)',
  transparent: 'transparent',
} as const;

export const caseStatusColors: Record<string, { fg: string; bg: string }> = {
  active: { fg: colors.info, bg: colors.infoSoft },
  pending: { fg: colors.warning, bg: colors.warningSoft },
  on_hold: { fg: colors.gold, bg: colors.goldSoft },
  closed: { fg: colors.textMuted, bg: 'rgba(138, 148, 171, 0.14)' },
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
    shadowColor: '#1A2C51',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: '#1A2C51',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const theme = { colors, spacing, radius, typography, shadow, caseStatusColors, priorityColors };

export type Theme = typeof theme;
