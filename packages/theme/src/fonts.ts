export const fontFamilies = {
  montserratRegular: 'Montserrat_400Regular',
  montserratMedium: 'Montserrat_500Medium',
  montserratSemiBold: 'Montserrat_600SemiBold',
  montserratBold: 'Montserrat_700Bold',
  latoRegular: 'Lato_400Regular',
  latoBold: 'Lato_700Bold',
} as const;

export const tailwindFontFamily = {
  sans: [fontFamilies.latoRegular],
  medium: [fontFamilies.latoRegular],
  semibold: [fontFamilies.montserratSemiBold],
  bold: [fontFamilies.montserratBold],
  heading: [fontFamilies.montserratBold],
  body: [fontFamilies.latoRegular],
};
