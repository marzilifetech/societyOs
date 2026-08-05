import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  strong?: boolean;   // slightly stronger border for emphasis
  glow?: 'primary' | 'emergency';  // add a subtle colored glow
}

export function ThemedCard({ children, style, strong, glow }: ThemedCardProps) {
  const t = useTheme();

  // Redesign-kit surface: white card, hairline border, soft drop shadow
  // (matches RoundCard in redesign.tsx so paper-era screens blend in).
  const shadowStyle = glow ? {
    shadowColor: glow === 'primary' ? t.glowPrimary : t.glowEmergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  } : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  };

  return (
    <View style={[{
      backgroundColor: '#FFFFFF',
      borderRadius: t.radiusLg,
      borderWidth: 1,
      borderColor: glow
        ? (glow === 'primary' ? 'rgba(130,26,82,0.3)' : 'rgba(255,59,48,0.3)')
        : (strong ? t.borderDefault : 'rgba(0,0,0,0.07)'),
      padding: t.cardPadding,
      ...shadowStyle,
    }, style]}>
      {children}
    </View>
  );
}
