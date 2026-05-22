export const defaultTokens = {
  fontXs: 12,
  fontSm: 14,
  fontBase: 16,
  fontLg: 18,
  fontXl: 20,
  font2xl: 24,
  font3xl: 30,
  font4xl: 36,
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' } as const,

  touchTarget: 52,
  touchTargetSm: 44,
  touchTargetLg: 60,

  cardPadding: 16,
  cardPaddingLg: 20,
  sectionGap: 16,
  screenPadding: 20,

  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusXl: 28,

  bgPrimary: '#FFFFFF',
  bgCard: '#F7F7F8',
  bgCardHover: '#F1F1F3',
  bgCardStrong: '#E8E8EC',
  borderSubtle: 'rgba(0,0,0,0.08)',
  borderDefault: 'rgba(0,0,0,0.12)',

  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.70)',
  textMuted: 'rgba(0,0,0,0.45)',
  textDisabled: 'rgba(0,0,0,0.25)',

  accentPrimary: '#821A52',
  accentSecondary: '#49CDAD',
  accentEmergency: '#dc2626',
  accentSuccess: '#16a34a',
  accentWarning: '#d97706',

  glowPrimary: 'rgba(130,26,82,0.30)',
  glowEmergency: 'rgba(220,38,38,0.40)',

  lineHeightTight: 1.2,
  lineHeightBase: 1.4,
  lineHeightRelaxed: 1.6,
  lineHeight: 1.4,

  iconSm: 18,
  iconMd: 22,
  iconLg: 28,
  iconXl: 36,
};

export const seniorTokens: typeof defaultTokens = {
  fontXs: 16,
  fontSm: 18,
  fontBase: 20,
  fontLg: 24,
  fontXl: 28,
  font2xl: 34,
  font3xl: 40,
  font4xl: 48,
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' } as const,

  touchTarget: 64,
  touchTargetSm: 56,
  touchTargetLg: 76,

  cardPadding: 24,
  cardPaddingLg: 28,
  sectionGap: 24,
  screenPadding: 24,

  radiusSm: 16,
  radiusMd: 20,
  radiusLg: 28,
  radiusXl: 36,

  bgPrimary: '#FFFFFF',
  bgCard: '#F4F4F6',
  bgCardHover: '#ECECEF',
  bgCardStrong: '#DDDDE3',
  borderSubtle: 'rgba(0,0,0,0.12)',
  borderDefault: 'rgba(0,0,0,0.18)',

  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.85)',
  textMuted: 'rgba(0,0,0,0.65)',
  textDisabled: 'rgba(0,0,0,0.40)',

  accentPrimary: '#821A52',
  accentSecondary: '#49CDAD',
  accentEmergency: '#dc2626',
  accentSuccess: '#16a34a',
  accentWarning: '#d97706',

  glowPrimary: 'rgba(130,26,82,0.40)',
  glowEmergency: 'rgba(220,38,38,0.50)',

  lineHeightTight: 1.3,
  lineHeightBase: 1.6,
  lineHeightRelaxed: 1.75,
  lineHeight: 1.6,

  iconSm: 24,
  iconMd: 30,
  iconLg: 40,
  iconXl: 52,
};
