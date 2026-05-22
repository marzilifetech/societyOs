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

  const bgColors: Record<Variant, string> = {
    primary: disabled ? 'rgba(130,26,82,0.35)' : t.accentPrimary,
    secondary: t.bgCardStrong,
    ghost: 'transparent',
    danger: disabled ? 'rgba(255,59,48,0.35)' : t.accentEmergency,
  };

  const textColors: Record<Variant, string> = {
    primary: '#FFFFFF',
    secondary: t.textPrimary,
    ghost: t.accentPrimary,
    danger: '#FFFFFF',
  };

  const borders: Record<Variant, string> = {
    primary: 'transparent',
    secondary: t.borderDefault,
    ghost: t.accentPrimary,
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
          borderRadius: t.radiusMd,
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
          fontWeight: '600',
          letterSpacing: size === 'sm' ? 0.2 : 0.3,
        }, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
