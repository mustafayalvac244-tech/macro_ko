// Vekil :: theme palettes
// Four fully detailed palettes. Every palette provides the exact same set of
// color tokens so any screen can be themed by swapping the active palette.

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  surfaceAlt: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  primarySoft: string;
  gold: string;
  goldSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  transparent: string;
}

export type ThemeId = 'light' | 'dark' | 'sepia' | 'emerald';

export interface ThemeMeta {
  id: ThemeId;
  name: string; // Turkish display name
  nameEn: string;
  statusBar: 'light' | 'dark'; // status bar icon style for this theme
  swatch: [string, string, string]; // preview swatch: bg, primary, gold
}

// ── 1) Klasik — cool light, navy + gold ────────────────────────────────────
const light: ThemeColors = {
  bg: '#F4F6FA',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHover: '#EEF1F7',
  surfaceAlt: '#F1F4F9',
  border: '#D7DEEA',
  borderSubtle: '#E7EBF3',
  textPrimary: '#16203A',
  textSecondary: '#4E5A74',
  textMuted: '#8A94AB',
  textInverse: '#FFFFFF',
  primary: '#1E4B9E',
  primaryMuted: '#DCE6F7',
  primarySoft: 'rgba(30, 75, 158, 0.10)',
  gold: '#A87F2E',
  goldSoft: 'rgba(168, 127, 46, 0.12)',
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
};

// ── 2) Gece — midnight navy dark ────────────────────────────────────────────
const dark: ThemeColors = {
  bg: '#0A1120',
  bgElevated: '#111C30',
  surface: '#141F37',
  surfaceHover: '#1C2B46',
  surfaceAlt: '#0F1A2E',
  border: '#2A3B57',
  borderSubtle: '#1E2C44',
  textPrimary: '#EAF0FA',
  textSecondary: '#A4B2CA',
  textMuted: '#6E7C95',
  textInverse: '#0A1120',
  primary: '#4C82E8',
  primaryMuted: '#1E355F',
  primarySoft: 'rgba(76, 130, 232, 0.16)',
  gold: '#EBC96E',
  goldSoft: 'rgba(235, 201, 110, 0.18)',
  success: '#34C77B',
  successSoft: 'rgba(52, 199, 123, 0.16)',
  warning: '#E0A94A',
  warningSoft: 'rgba(224, 169, 74, 0.16)',
  danger: '#E8595F',
  dangerSoft: 'rgba(232, 89, 95, 0.16)',
  info: '#45A0E6',
  infoSoft: 'rgba(69, 160, 230, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.62)',
  transparent: 'transparent',
};

// ── 3) Parşömen — warm sepia paper, brand cream + navy + gold ──────────────
const sepia: ThemeColors = {
  bg: '#EDE8DC',
  bgElevated: '#F8F4EB',
  surface: '#F8F4EB',
  surfaceHover: '#EAE2D1',
  surfaceAlt: '#F2ECDF',
  border: '#D8CDB6',
  borderSubtle: '#E6DDC8',
  textPrimary: '#2E2617',
  textSecondary: '#5D5238',
  textMuted: '#948769',
  textInverse: '#FFFFFF',
  primary: '#1C3A5E',
  primaryMuted: '#D7DFEA',
  primarySoft: 'rgba(28, 58, 94, 0.10)',
  gold: '#9C7A24',
  goldSoft: 'rgba(156, 122, 36, 0.15)',
  success: '#4E7D3F',
  successSoft: 'rgba(78, 125, 63, 0.14)',
  warning: '#A9791A',
  warningSoft: 'rgba(169, 121, 26, 0.15)',
  danger: '#A9443B',
  dangerSoft: 'rgba(169, 68, 59, 0.13)',
  info: '#3E6E8E',
  infoSoft: 'rgba(62, 110, 142, 0.13)',
  overlay: 'rgba(46, 38, 23, 0.42)',
  transparent: 'transparent',
};

// ── 4) Zümrüt — emerald corporate on soft light ─────────────────────────────
const emerald: ThemeColors = {
  bg: '#EFF4F1',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHover: '#E6EFEA',
  surfaceAlt: '#EDF4F0',
  border: '#CEDDD5',
  borderSubtle: '#E1ECE6',
  textPrimary: '#132A22',
  textSecondary: '#3E594E',
  textMuted: '#7F958A',
  textInverse: '#FFFFFF',
  primary: '#0E7A5A',
  primaryMuted: '#CFE7DD',
  primarySoft: 'rgba(14, 122, 90, 0.10)',
  gold: '#A9821F',
  goldSoft: 'rgba(169, 130, 31, 0.13)',
  success: '#1B9E63',
  successSoft: 'rgba(27, 158, 99, 0.13)',
  warning: '#B4831A',
  warningSoft: 'rgba(180, 131, 26, 0.13)',
  danger: '#C24236',
  dangerSoft: 'rgba(194, 66, 54, 0.12)',
  info: '#1C7FA0',
  infoSoft: 'rgba(28, 127, 160, 0.12)',
  overlay: 'rgba(19, 42, 34, 0.42)',
  transparent: 'transparent',
};

export const palettes: Record<ThemeId, ThemeColors> = { light, dark, sepia, emerald };

export const themeMetas: ThemeMeta[] = [
  { id: 'light', name: 'Klasik', nameEn: 'Classic', statusBar: 'dark', swatch: ['#F4F6FA', '#1E4B9E', '#A87F2E'] },
  { id: 'dark', name: 'Gece', nameEn: 'Midnight', statusBar: 'light', swatch: ['#0A1120', '#4C82E8', '#D9B863'] },
  { id: 'sepia', name: 'Parşömen', nameEn: 'Parchment', statusBar: 'dark', swatch: ['#EDE8DC', '#1C3A5E', '#9C7A24'] },
  { id: 'emerald', name: 'Zümrüt', nameEn: 'Emerald', statusBar: 'dark', swatch: ['#EFF4F1', '#0E7A5A', '#A9821F'] },
];

export function caseStatusColorsFor(c: ThemeColors): Record<string, { fg: string; bg: string }> {
  return {
    active: { fg: c.info, bg: c.infoSoft },
    pending: { fg: c.warning, bg: c.warningSoft },
    on_hold: { fg: c.gold, bg: c.goldSoft },
    closed: { fg: c.textMuted, bg: c.surfaceHover },
    won: { fg: c.success, bg: c.successSoft },
    lost: { fg: c.danger, bg: c.dangerSoft },
  };
}

export function priorityColorsFor(c: ThemeColors): Record<string, string> {
  return {
    low: c.textMuted,
    medium: c.info,
    high: c.warning,
    critical: c.danger,
  };
}
