import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Display, IconCircle, PillButton, rd } from './redesign';

/**
 * EmptyState — centered "nothing here yet" block for lists and history
 * screens (redesign kit: soft-tint IconCircle + serif title + muted body +
 * optional pill CTA).
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 }, style]}>
      <IconCircle icon={icon} size={56} bg={rd.crimsonSoft} color={t.accentPrimary} />
      <Display size="sm" align="center" style={{ marginTop: 16 }}>
        {title}
      </Display>
      {body ? (
        <Text
          style={{
            color: t.textMuted,
            fontSize: t.fontBase,
            textAlign: 'center',
            lineHeight: t.fontBase * t.lineHeightBase,
            marginTop: 8,
          }}
        >
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PillButton
          label={actionLabel}
          onPress={onAction}
          tone="dark"
          size="md"
          fullWidth={false}
          style={{ marginTop: 20, paddingHorizontal: 28 }}
        />
      ) : null}
    </View>
  );
}
