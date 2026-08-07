import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Override default back behaviour (router.back). Pass null to hide the back button entirely. */
  onBack?: (() => void) | null;
  /** Optional trailing element (icon button, badge, etc.) rendered on the right. */
  trailing?: React.ReactNode;
  /** Visual variant. `transparent` is for screens that paint their own background. */
  variant?: 'default' | 'transparent';
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  trailing,
  variant = 'default',
}: ScreenHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  // Tab roots must never show a back chevron. canGoBack() is not a usable
  // signal here: switching tabs adds history, so it reports true on a tab root
  // and the chevron would either sit there doing nothing or yank the user out
  // of the tab they just opened. The segment check is the deterministic test.
  //
  // Screens like app/events/index.tsx are rendered BOTH as a tab and as a
  // pushed route from Home, so this has to be decided at runtime rather than
  // hard-coded per screen.
  const isTabRoot = segments[0] === '(tabs)';
  const showBack =
    onBack === null
      ? false
      : typeof onBack === 'function'
      ? true
      : !isTabRoot && router.canGoBack();

  const handleBack = () => {
    if (typeof onBack === 'function') return onBack();
    if (router.canGoBack()) router.back();
  };

  const bg = variant === 'transparent' ? 'transparent' : t.bgPrimary;

  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      <View
        style={{
          minHeight: t.touchTarget,
          paddingHorizontal: t.screenPadding,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: t.touchTargetSm,
              height: t.touchTargetSm,
              borderRadius: t.touchTargetSm / 2,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name="chevron-back" size={24} color={t.textPrimary} />
          </TouchableOpacity>
        ) : null}
        {/* No placeholder spacer when the back button is hidden — reserving the
            chevron's width pushed the title inwards, so "Notice Board" sat
            indented while every other screen's title started at the margin. */}

        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              fontSize: t.fontXl,
              fontWeight: '700',
              color: t.textPrimary,
              letterSpacing: 0.2,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
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

        {trailing ? (
          <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>{trailing}</View>
        ) : null}
      </View>
    </View>
  );
}
