// Back-compat barrel. Static tokens live in tokens.ts; the live palette is
// resolved via useTheme(). `colors` here is the DEFAULT palette — used only as
// a fallback by any code not yet reading the reactive theme.
//
// 15.09.2026: varsayılan Terminal oldu (ürün sahibi kararı). Bu satır da
// onunla birlikte değişti: geri düşüş klasik lacivertte kalsaydı, reaktif
// temayı okumayan bir yer koyu ekranın ortasında açık tema renkleriyle
// çizilirdi — en görünür hâli okunmayan yazı olurdu.
export { spacing, radius, typography, shadow, fonts, kose, monoTemaMi, temaTokenlariniUygula, temaTokenlari } from './tokens';
export { palettes, themeMetas, caseStatusColorsFor, priorityColorsFor } from './palettes';
export type { ThemeColors, ThemeId } from './palettes';

import { palettes, caseStatusColorsFor, priorityColorsFor } from './palettes';

export const colors = palettes.terminal;
export const caseStatusColors = caseStatusColorsFor(palettes.terminal);
export const priorityColors = priorityColorsFor(palettes.terminal);

import { spacing, radius, typography, shadow } from './tokens';
export const theme = { colors, spacing, radius, typography, shadow, caseStatusColors, priorityColors };
export type Theme = typeof theme;
