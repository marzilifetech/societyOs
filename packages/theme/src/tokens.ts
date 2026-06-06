// Two token scales: defaultTokens (compact) and seniorTokens (the larger,
// higher-contrast scale used by default in the Marzi Senior Community apps).
//
// Tuning principles:
//  - Senior is bigger than default, but only modestly so — never so big that
//    a typical title wraps to a second line on a phone-width screen.
//  - Corner radii are intentionally small/sharp across both scales (modern
//    look). Pill-rounded UI looked toy-like for our audience.
//  - Touch targets are generous (≥48px) without being huge.

export const defaultTokens = {
  fontXs: 12,
  fontSm: 14,
  fontBase: 16,
  fontLg: 18,
  fontXl: 20,
  font2xl: 22,
  font3xl: 26,
  font4xl: 32,
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' } as const,

  touchTarget: 48,
  touchTargetSm: 40,
  touchTargetLg: 56,

  cardPadding: 16,
  cardPaddingLg: 20,
  sectionGap: 16,
  screenPadding: 20,

  // Paper design — corners are nearly flat (was 12 / 16 / 20 / 28).
  radiusSm: 2,
  radiusMd: 4,
  radiusLg: 6,
  radiusXl: 8,

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
  // ~15–20% larger than default. Big enough to be elder-friendly, small
  // enough that titles stay on one line and lists don't break.
  fontXs: 13,
  fontSm: 15,
  fontBase: 17,
  fontLg: 19,
  fontXl: 22,
  font2xl: 24,
  font3xl: 28,
  font4xl: 34,
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' } as const,

  touchTarget: 56,
  touchTargetSm: 48,
  touchTargetLg: 64,

  cardPadding: 18,
  cardPaddingLg: 22,
  sectionGap: 18,
  screenPadding: 20,

  // Same flat paper radii as default — the senior treatment is bigger text
  // and contrast, NOT rounder shapes.
  radiusSm: 2,
  radiusMd: 4,
  radiusLg: 6,
  radiusXl: 8,

  bgPrimary: '#FFFFFF',
  bgCard: '#F4F4F6',
  bgCardHover: '#ECECEF',
  bgCardStrong: '#DDDDE3',
  borderSubtle: 'rgba(0,0,0,0.12)',
  borderDefault: 'rgba(0,0,0,0.18)',

  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.80)',
  textMuted: 'rgba(0,0,0,0.55)',
  textDisabled: 'rgba(0,0,0,0.35)',

  accentPrimary: '#821A52',
  accentSecondary: '#49CDAD',
  accentEmergency: '#dc2626',
  accentSuccess: '#16a34a',
  accentWarning: '#d97706',

  glowPrimary: 'rgba(130,26,82,0.40)',
  glowEmergency: 'rgba(220,38,38,0.50)',

  lineHeightTight: 1.25,
  lineHeightBase: 1.45,
  lineHeightRelaxed: 1.6,
  lineHeight: 1.45,

  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 42,
};
