import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  strong?: boolean;   // stronger/brighter card bg
  glow?: 'primary' | 'emergency';  // add a subtle colored glow
}

export function ThemedCard({ children, style, strong, glow }: ThemedCardProps) {
  const t = useTheme();

  const shadowStyle = glow ? {
    shadowColor: glow === 'primary' ? t.glowPrimary : t.glowEmergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  } : {};

  return (
    <View style={[{
      backgroundColor: strong ? t.bgCardStrong : t.bgCard,
      borderRadius: t.radiusLg,
      borderWidth: 1,
      borderColor: glow ? (glow === 'primary' ? 'rgba(130,26,82,0.3)' : 'rgba(255,59,48,0.3)') : t.borderDefault,
      padding: t.cardPadding,
      ...shadowStyle,
    }, style]}>
      {children}
    </View>
  );
}
