import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ThemedButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function ThemedButton({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, accessibilityLabel, accessibilityHint,
  style, textStyle, fullWidth = true,
}: ThemedButtonProps) {
  const t = useTheme();

  const heights = { sm: t.touchTargetSm, md: t.touchTarget, lg: t.touchTargetLg };
  const fontSizes = { sm: t.fontSm, md: t.fontBase, lg: t.fontLg };

  // Redesign-kit pill tones (matches PillButton in redesign.tsx):
  // primary = ink black, danger = crimson, secondary/ghost = white outline.
  const bgColors: Record<Variant, string> = {
    primary: disabled ? 'rgba(20,20,20,0.35)' : '#141414',
    secondary: '#FFFFFF',
    ghost: '#FFFFFF',
    danger: disabled ? 'rgba(196,40,71,0.35)' : '#C42847',
  };

  const textColors: Record<Variant, string> = {
    primary: '#FFFFFF',
    secondary: t.textPrimary,
    ghost: t.accentPrimary,
    danger: '#FFFFFF',
  };

  const borders: Record<Variant, string> = {
    primary: 'transparent',
    secondary: 'rgba(0,0,0,0.12)',
    ghost: 'rgba(0,0,0,0.12)',
    danger: 'transparent',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        {
          minHeight: heights[size],
          backgroundColor: bgColors[variant],
          borderRadius: 999,
          borderWidth: variant === 'secondary' || variant === 'ghost' ? 1 : 0,
          borderColor: borders[variant],
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: t.cardPadding,
          width: fullWidth ? '100%' : undefined,
          opacity: (disabled && !loading) ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <Text style={[{
          color: textColors[variant],
          fontSize: fontSizes[size],
          fontWeight: '700',
          letterSpacing: size === 'sm' ? 0.2 : 0.3,
        }, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
