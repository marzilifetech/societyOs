import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Variant = 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'muted';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

interface ThemedTextProps {
  children: React.ReactNode;
  variant?: Variant;
  weight?: Weight;
  color?: string;
  style?: TextStyle;
  accessibilityRole?: 'header' | 'text' | 'none';
}

export function ThemedText({
  children, variant = 'body', weight, color, style, accessibilityRole,
}: ThemedTextProps) {
  const t = useTheme();

  const variantStyles: Record<Variant, TextStyle> = {
    heading:    { fontSize: t.font3xl, fontWeight: '700', color: t.textPrimary, lineHeight: t.font3xl * t.lineHeightTight },
    subheading: { fontSize: t.font2xl, fontWeight: '600', color: t.textPrimary, lineHeight: t.font2xl * t.lineHeightBase },
    body:       { fontSize: t.fontBase, fontWeight: '400', color: t.textPrimary, lineHeight: t.fontBase * t.lineHeightBase },
    caption:    { fontSize: t.fontSm, fontWeight: '400', color: t.textSecondary, lineHeight: t.fontSm * t.lineHeightBase },
    label:      { fontSize: t.fontSm, fontWeight: '600', color: t.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
    muted:      { fontSize: t.fontSm, fontWeight: '400', color: t.textMuted, lineHeight: t.fontSm * t.lineHeightRelaxed },
  };

  return (
    <Text
      accessibilityRole={accessibilityRole}
      style={[
        variantStyles[variant],
        weight ? { fontWeight: t.fontWeight[weight] } : undefined,
        color ? { color } : undefined,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
