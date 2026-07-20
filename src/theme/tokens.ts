// Static design tokens shared by every theme (do not change per palette).

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

// Uygulama fontları: gövde Manrope (kurumsal, Türkçe destekli), marka yazısı
// Dancing Script (imza havası, okunaklı). Ağırlık başına ayrı dosya kullanılır;
// font yüklenemezse sistem fontu + fontWeight devreye girer (güvenli düşüş).
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  script: 'DancingScript_700Bold',
} as const;

export const typography = {
  display: { fontSize: 30, fontFamily: fonts.bold, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontFamily: fonts.bold, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontFamily: fonts.bold, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontFamily: fonts.semibold, fontWeight: '600' as const },
  body: { fontSize: 15, fontFamily: fonts.regular, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontFamily: fonts.semibold, fontWeight: '600' as const },
  caption: { fontSize: 13, fontFamily: fonts.medium, fontWeight: '500' as const },
  small: { fontSize: 11, fontFamily: fonts.semibold, fontWeight: '600' as const, letterSpacing: 0.4 },
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
