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

// Paper design — keep corners flat. See spacing.ts for the source of truth.
// Note: `full` is intentionally NOT 9999 here — capsule pills and circular
// avatars should become slight-rounded paper rectangles too.
const borderRadius = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  '2xl': 10,
  full: 6,
};

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
