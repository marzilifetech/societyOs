import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface RadioCardProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading icon name (Ionicons). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Override the leading visual entirely. */
  leading?: React.ReactNode;
  /** Override the trailing visual (defaults to a radio dot). */
  trailing?: React.ReactNode;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}

/**
 * Large, senior-friendly selectable card. Use for category pickers,
 * one-of-N choices, and confirmation prompts.
 */
export function RadioCard({
  title,
  subtitle,
  selected,
  onPress,
  icon,
  leading,
  trailing,
  disabled = false,
  accessibilityHint,
  style,
}: RadioCardProps) {
  const t = useTheme();

  const borderColor = selected ? t.accentPrimary : t.borderDefault;
  const bg = selected ? 'rgba(130,26,82,0.06)' : t.bgPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={title + (subtitle ? `, ${subtitle}` : '')}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.85}
      style={[
        {
          minHeight: t.touchTargetLg,
          paddingVertical: 14,
          paddingHorizontal: t.cardPadding,
          borderRadius: t.radiusMd,
          borderWidth: selected ? 2 : 1,
          borderColor,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {leading ?? (icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: t.radiusMd, // paper design — slight square, not circle
            backgroundColor: selected ? t.accentPrimary : t.bgCardStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={selected ? '#FFFFFF' : t.textPrimary} />
        </View>
      ) : null)}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: t.fontBase,
            fontWeight: '600',
            color: t.textPrimary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: t.fontSm,
              color: t.textSecondary,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ?? <RadioDot selected={selected} />}
    </TouchableOpacity>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 4, // paper design — square selection indicator (checkbox-style)
        borderWidth: 2,
        borderColor: selected ? t.accentPrimary : t.borderDefault,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: t.accentPrimary,
          }}
        />
      ) : null}
    </View>
  );
}
