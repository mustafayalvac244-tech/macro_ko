// Back-compat barrel. Static tokens live in tokens.ts; the live palette is
// resolved via useTheme(). `colors` here is the default (light) palette — used
// only as a fallback by any code not yet reading the reactive theme.
export { spacing, radius, typography, shadow, fonts } from './tokens';
export { palettes, themeMetas, caseStatusColorsFor, priorityColorsFor } from './palettes';
export type { ThemeColors, ThemeId } from './palettes';

import { palettes, caseStatusColorsFor, priorityColorsFor } from './palettes';

export const colors = palettes.light;
export const caseStatusColors = caseStatusColorsFor(palettes.light);
export const priorityColors = priorityColorsFor(palettes.light);

import { spacing, radius, typography, shadow } from './tokens';
export const theme = { colors, spacing, radius, typography, shadow, caseStatusColors, priorityColors };
export type Theme = typeof theme;
