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

export type ThemeId = 'light' | 'dark' | 'sepia' | 'emerald' | 'obsidian';

export interface ThemeMeta {
  id: ThemeId;
  name: string; // Turkish display name
  nameEn: string;
  statusBar: 'light' | 'dark'; // status bar icon style for this theme
  swatch: [string, string, string]; // preview swatch: bg, primary, gold
}

// ── 1) Klasik — cool marble light, deep royal navy + antique gold ───────────
// Hukuk bürosu antetli kâğıdı hissi: hafif serin mermer zemin, kendinden emin
// koyu lacivert ve gerçek pirinç/altın vurgu. Kartlar zeminden belirgin kalkar.
const light: ThemeColors = {
  bg: '#EEF2F8',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHover: '#E7EDF7',
  surfaceAlt: '#F4F7FC',
  border: '#CFD9EA',
  borderSubtle: '#E4EAF4',
  textPrimary: '#0F1B33',
  textSecondary: '#44506B',
  textMuted: '#828EA6',
  textInverse: '#FFFFFF',
  primary: '#173C7E',
  primaryMuted: '#D5E1F5',
  primarySoft: 'rgba(23, 60, 126, 0.09)',
  // "Her yer lacivert": aksan altını, temanın primary'sine sabitlendi.
  gold: '#173C7E',
  goldSoft: 'rgba(23, 60, 126, 0.09)',
  success: '#158A54',
  successSoft: 'rgba(21, 138, 84, 0.12)',
  warning: '#B27811',
  warningSoft: 'rgba(178, 120, 17, 0.12)',
  danger: '#CE353D',
  dangerSoft: 'rgba(206, 53, 61, 0.11)',
  info: '#1C6DBD',
  infoSoft: 'rgba(28, 109, 189, 0.11)',
  overlay: 'rgba(8, 15, 31, 0.48)',
  transparent: 'transparent',
};

// ── 2) Gece — deep midnight chambers, sapphire + warm gold ──────────────────
// Zengin gece laciverti; yüzeyler kademeli koyulukta (kartlar birbirinden
// ayrışır), altın sıcak ve okunaklı. Gece çalışan avukat için dinlendirici.
const dark: ThemeColors = {
  bg: '#070E1B',
  bgElevated: '#0E1A2E',
  surface: '#13203A',
  surfaceHover: '#1D2E4C',
  surfaceAlt: '#0D1930',
  border: '#294064',
  borderSubtle: '#1C2D48',
  textPrimary: '#ECF2FC',
  textSecondary: '#A5B4CD',
  textMuted: '#6B7B97',
  textInverse: '#070E1B',
  primary: '#5B8DEF',
  primaryMuted: '#1F3A6B',
  primarySoft: 'rgba(91, 141, 239, 0.17)',
  gold: '#5B8DEF',
  goldSoft: 'rgba(91, 141, 239, 0.17)',
  success: '#31CC7D',
  successSoft: 'rgba(49, 204, 125, 0.16)',
  warning: '#E4AC4B',
  warningSoft: 'rgba(228, 172, 75, 0.16)',
  danger: '#ED5A61',
  dangerSoft: 'rgba(237, 90, 97, 0.16)',
  info: '#4BA4EC',
  infoSoft: 'rgba(75, 164, 236, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.66)',
  transparent: 'transparent',
};

// ── 3) Parşömen — fine aged paper, ink navy + aged gold ─────────────────────
// Kaliteli kâğıt/deri dokunuşu: derin kahve-mürekkep metin, dolmakalem
// laciverti ve eskitilmiş altın. Sıcak ama ciddi bir klasik defter hissi.
const sepia: ThemeColors = {
  bg: '#E7DECB',
  bgElevated: '#F8F3E7',
  surface: '#F8F3E7',
  surfaceHover: '#EDE4D0',
  surfaceAlt: '#F2EBDA',
  border: '#D3C6A9',
  borderSubtle: '#E3D9C1',
  textPrimary: '#281F11',
  textSecondary: '#564A30',
  textMuted: '#8F8161',
  textInverse: '#FFFFFF',
  primary: '#1B3A5D',
  primaryMuted: '#D4DDE9',
  primarySoft: 'rgba(27, 58, 93, 0.10)',
  gold: '#1B3A5D',
  goldSoft: 'rgba(27, 58, 93, 0.10)',
  success: '#4B7A3C',
  successSoft: 'rgba(75, 122, 60, 0.14)',
  warning: '#9F7017',
  warningSoft: 'rgba(159, 112, 23, 0.15)',
  danger: '#A34038',
  dangerSoft: 'rgba(163, 64, 56, 0.13)',
  info: '#3A6786',
  infoSoft: 'rgba(58, 103, 134, 0.13)',
  overlay: 'rgba(40, 31, 17, 0.46)',
  transparent: 'transparent',
};

// ── 4) Zümrüt — deep forest emerald, corporate on soft mint ─────────────────
// Kurumsal, güven veren koyu zümrüt; yumuşak nane zemin ve pirinç altın.
// Modern hukuk danışmanlığı ofisinin duvar rengi gibi.
const emerald: ThemeColors = {
  bg: '#E9F1EC',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHover: '#E0EBE4',
  surfaceAlt: '#EDF4EF',
  border: '#C6D8CD',
  borderSubtle: '#DCE9E1',
  textPrimary: '#0D2820',
  textSecondary: '#375349',
  textMuted: '#788F84',
  textInverse: '#FFFFFF',
  primary: '#0A6349',
  primaryMuted: '#C7E4D8',
  primarySoft: 'rgba(10, 99, 73, 0.10)',
  gold: '#0A6349',
  goldSoft: 'rgba(10, 99, 73, 0.10)',
  success: '#158A54',
  successSoft: 'rgba(21, 138, 84, 0.13)',
  warning: '#AC7B15',
  warningSoft: 'rgba(172, 123, 21, 0.13)',
  danger: '#BC3E33',
  dangerSoft: 'rgba(188, 62, 51, 0.12)',
  info: '#177A9A',
  infoSoft: 'rgba(23, 122, 154, 0.12)',
  overlay: 'rgba(13, 40, 32, 0.46)',
  transparent: 'transparent',
};

// ── 5) Obsidyen — EPİK: gece siyahı obsidyen + som altın ────────────────────
// Amiral tema. Sıcak kömür-siyah zemin üzerinde altın BAŞ renktir (mavi değil):
// başlıklar, ikonlar, vurgular som altınla parlar. Metin saf beyaz değil, sıcak
// fildişi — pahalı, dingin, "üst düzey ortak avukat" hissi. Yüzeyler kademeli
// koyulukta; altın kenar vurgularıyla kartlar mücevher kutusu gibi durur.
const obsidian: ThemeColors = {
  bg: '#0A0A0D',
  bgElevated: '#131318',
  surface: '#17171D',
  surfaceHover: '#212129',
  surfaceAlt: '#101015',
  border: '#33323C',
  borderSubtle: '#232229',
  textPrimary: '#F6F1E6',
  textSecondary: '#B8B2A4',
  textMuted: '#7E7869',
  textInverse: '#0A0A0D',
  primary: '#E3BE58',
  primaryMuted: '#3A3320',
  primarySoft: 'rgba(227, 190, 88, 0.15)',
  gold: '#E9C766',
  goldSoft: 'rgba(233, 199, 102, 0.18)',
  success: '#4FB98A',
  successSoft: 'rgba(79, 185, 138, 0.16)',
  warning: '#E0A94A',
  warningSoft: 'rgba(224, 169, 74, 0.16)',
  danger: '#E06A62',
  dangerSoft: 'rgba(224, 106, 98, 0.16)',
  info: '#6E93C9',
  infoSoft: 'rgba(110, 147, 201, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  transparent: 'transparent',
};

export const palettes: Record<ThemeId, ThemeColors> = { light, dark, sepia, emerald, obsidian };

export const themeMetas: ThemeMeta[] = [
  { id: 'light', name: 'Klasik', nameEn: 'Classic', statusBar: 'dark', swatch: ['#EEF2F8', '#173C7E', '#B18A2B'] },
  { id: 'dark', name: 'Gece', nameEn: 'Midnight', statusBar: 'light', swatch: ['#070E1B', '#5B8DEF', '#E9C86E'] },
  { id: 'sepia', name: 'Parşömen', nameEn: 'Parchment', statusBar: 'dark', swatch: ['#E7DECB', '#1B3A5D', '#8F6E1D'] },
  { id: 'emerald', name: 'Zümrüt', nameEn: 'Emerald', statusBar: 'dark', swatch: ['#E9F1EC', '#0A6349', '#A97F1B'] },
  { id: 'obsidian', name: 'Obsidyen', nameEn: 'Obsidian', statusBar: 'light', swatch: ['#0A0A0D', '#E3BE58', '#E9C766'] },
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
