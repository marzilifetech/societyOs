import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'pending'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger'
  | 'cancelled';

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Compact (sm) keeps the chip ≥36, regular keeps ≥44 to remain tappable when used as a button. */
  size?: 'sm' | 'md';
}

const TONE_COLORS: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  neutral:   { bg: 'rgba(0,0,0,0.06)',  fg: 'rgba(0,0,0,0.80)',  border: 'rgba(0,0,0,0.10)' },
  info:      { bg: 'rgba(33,118,255,0.10)', fg: '#1565C0',       border: 'rgba(33,118,255,0.20)' },
  pending:   { bg: 'rgba(255,179,0,0.12)',  fg: '#8A5A00',       border: 'rgba(255,179,0,0.25)' },
  progress:  { bg: 'rgba(130,26,82,0.10)',  fg: '#821A52',       border: 'rgba(130,26,82,0.20)' },
  success:   { bg: 'rgba(22,163,74,0.12)',  fg: '#15803d',       border: 'rgba(22,163,74,0.25)' },
  warning:   { bg: 'rgba(234,88,12,0.12)',  fg: '#9A3412',       border: 'rgba(234,88,12,0.25)' },
  danger:    { bg: 'rgba(220,38,38,0.10)',  fg: '#B91C1C',       border: 'rgba(220,38,38,0.25)' },
  cancelled: { bg: 'rgba(0,0,0,0.04)',  fg: 'rgba(0,0,0,0.55)',  border: 'rgba(0,0,0,0.12)' },
};

export function StatusChip({ label, tone = 'neutral', icon, size = 'sm' }: StatusChipProps) {
  const t = useTheme();
  const c = TONE_COLORS[tone];
  const padY = size === 'sm' ? 4 : 8;
  const padX = size === 'sm' ? 10 : 14;
  const font = size === 'sm' ? t.fontXs : t.fontSm;
  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: padY,
        paddingHorizontal: padX,
        borderRadius: 4, // paper design — slight-rounded rectangle, not pill
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {icon ? <Ionicons name={icon} size={iconSize} color={c.fg} /> : null}
      <Text
        numberOfLines={1}
        style={{
          fontSize: font,
          fontWeight: '600',
          color: c.fg,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
