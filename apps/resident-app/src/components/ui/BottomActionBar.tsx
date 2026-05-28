import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ThemedButton } from './ThemedButton';

type Action = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

interface BottomActionBarProps {
  primary: Action;
  /** Optional secondary action — rendered to the left of the primary in a row. */
  secondary?: Action;
  /** Optional helper text shown above the buttons. */
  helperText?: string;
  /** Defaults to true. Set false on screens that handle their own bottom safe-area. */
  withSafeArea?: boolean;
  style?: ViewStyle;
}

export function BottomActionBar({
  primary,
  secondary,
  helperText,
  withSafeArea = true,
  style,
}: BottomActionBarProps) {
  const t = useTheme();

  const buttons = (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {secondary ? (
        <View style={{ flex: 1 }}>
          <ThemedButton
            label={secondary.label}
            onPress={secondary.onPress}
            variant={secondary.variant ?? 'secondary'}
            loading={secondary.loading}
            disabled={secondary.disabled}
            accessibilityLabel={secondary.accessibilityLabel}
            accessibilityHint={secondary.accessibilityHint}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <ThemedButton
          label={primary.label}
          onPress={primary.onPress}
          variant={primary.variant ?? 'primary'}
          loading={primary.loading}
          disabled={primary.disabled}
          accessibilityLabel={primary.accessibilityLabel}
          accessibilityHint={primary.accessibilityHint}
        />
      </View>
    </View>
  );

  const inner = (
    <View
      style={[
        {
          paddingHorizontal: t.screenPadding,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: t.bgPrimary,
          borderTopWidth: 1,
          borderTopColor: t.borderSubtle,
        },
        style,
      ]}
    >
      {helperText ? (
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.fontXs,
            color: t.textMuted,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          {helperText}
        </Text>
      ) : null}
      {buttons}
    </View>
  );

  if (!withSafeArea) return inner;
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.bgPrimary }}>
      {inner}
    </SafeAreaView>
  );
}
