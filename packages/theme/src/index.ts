import { colors } from './colors';
import { tailwindFontFamily } from './fonts';
import { spacing, radius } from './spacing';

export * from './colors';
export * from './fonts';
export * from './spacing';
export * from './tokens';

export const tailwindThemeExtend = {
  colors,
  fontFamily: tailwindFontFamily,
  spacing,
  borderRadius: radius,
};
