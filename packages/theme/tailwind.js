// CommonJS sibling for Tailwind/NativeWind config consumers.
// Node's plain require can't load the .ts source files; this mirrors them.
// Keep in sync with packages/theme/src/{colors,fonts,spacing}.ts.

const colors = {
  primary: {
    50: '#FBEEF5',
    100: '#F4D2E4',
    200: '#E6A5C8',
    300: '#D578AC',
    400: '#B84A87',
    500: '#821A52',
    600: '#6E1546',
    700: '#591038',
    800: '#420A29',
    900: '#26051A',
  },
  secondary: {
    50: '#E8FBF5',
    100: '#CFF6EA',
    200: '#A6EDD6',
    300: '#7CE3C2',
    400: '#5AD8B5',
    500: '#49CDAD',
    600: '#34A98D',
    700: '#28856E',
    800: '#1B5E4E',
    900: '#0F3A30',
  },
  accent: {
    50: '#E8FBF5',
    100: '#CFF6EA',
    200: '#A6EDD6',
    300: '#7CE3C2',
    400: '#5AD8B5',
    500: '#49CDAD',
    600: '#34A98D',
    700: '#28856E',
    800: '#1B5E4E',
    900: '#0F3A30',
  },
  white: '#FFFFFF',
  black: '#000000',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  sos: '#dc2626',
};

const fontFamilies = {
  montserratRegular: 'Montserrat_400Regular',
  montserratMedium: 'Montserrat_500Medium',
  montserratSemiBold: 'Montserrat_600SemiBold',
  montserratBold: 'Montserrat_700Bold',
  latoRegular: 'Lato_400Regular',
  latoBold: 'Lato_700Bold',
};

const fontFamily = {
  sans: [fontFamilies.latoRegular],
  medium: [fontFamilies.latoRegular],
  semibold: [fontFamilies.montserratSemiBold],
  bold: [fontFamilies.montserratBold],
  heading: [fontFamilies.montserratBold],
  body: [fontFamilies.latoRegular],
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// 2026 redesign geometry — soft rounded surfaces. Mirrors spacing.ts (the
// source of truth): 16-20px cards, true capsule pills (`rounded-full` is a
// real circle again), circular avatars.
const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// Redesign soft tones (mirrors apps/resident-app redesign kit `rd` palette) —
// semantic surfaces + status tints usable from nativewind as e.g.
// `bg-surface`, `border-subtle`, `bg-sos-soft`, `text-warn-ink`.
const semantic = {
  surface: '#FFFFFF',
  'surface-muted': '#F5F5F6',
  'surface-raised': '#FFFFFF',
  ink: '#141414',
  'ink-soft': '#F2F2F3',
  subtle: 'rgba(0,0,0,0.07)',
  'sos-soft': '#FCE9EE',
  'success-soft': '#E7F4EC',
  'success-ink': '#1F7A45',
  'warn-soft': '#FBF1D9',
  'warn-ink': '#9A6B00',
};
Object.assign(colors, semantic);

const tailwindThemeExtend = {
  colors,
  fontFamily,
  spacing,
  borderRadius,
};

module.exports = {
  colors,
  fontFamilies,
  fontFamily,
  spacing,
  borderRadius,
  tailwindThemeExtend,
};
