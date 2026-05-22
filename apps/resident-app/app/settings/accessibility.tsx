import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAccessibilityStore } from '../../src/store/accessibility.store';
import { defaultTokens, seniorTokens } from '../../src/theme/tokens';
import { SeniorModeToggle } from '../../src/components/ui/SeniorModeToggle';

function PreviewCard({
  label,
  tokens,
  active,
  onPress,
}: {
  label: 'Standard' | 'Senior';
  tokens: typeof defaultTokens;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${label} mode`}
      accessibilityState={{ selected: active }}
      className={`flex-1 rounded-2xl p-4 justify-between ${
        active ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50 border border-gray-200'
      }`}
      style={{ minHeight: 140, padding: tokens.cardPadding }}
    >
      <View>
        <View className="flex-row items-center mb-2.5" style={{ gap: 6 }}>
          <View
            className={`w-2 h-2 rounded-full ${active ? 'bg-primary-500' : 'bg-gray-300'}`}
          />
          <Text
            className={`text-[10px] font-bold tracking-wider uppercase ${
              active ? 'text-primary-500' : 'text-gray-400'
            }`}
          >
            {label}
          </Text>
          {active && (
            <View className="ml-auto bg-primary-500 rounded-md px-1.5 py-0.5">
              <Text className="text-[9px] font-extrabold text-white tracking-wider">ON</Text>
            </View>
          )}
        </View>

        <Text
          className="text-gray-900 font-bold mb-1"
          style={{ fontSize: tokens.fontLg, lineHeight: tokens.fontLg * 1.25 }}
        >
          Good morning
        </Text>
        <Text
          className="text-gray-500 mb-2.5"
          style={{ fontSize: tokens.fontSm, lineHeight: tokens.fontSm * 1.5 }}
        >
          Your health summary{'\n'}is ready
        </Text>
      </View>

      <View
        className={`rounded-xl items-center justify-center ${active ? 'bg-primary-500' : 'bg-gray-200'}`}
        style={{ height: tokens.touchTargetSm }}
      >
        <Text
          className={`font-semibold ${active ? 'text-white' : 'text-gray-700'}`}
          style={{ fontSize: tokens.fontSm }}
        >
          View details
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AccessibilitySettingsScreen() {
  const { seniorMode, setSeniorMode } = useAccessibilityStore();

  const screenReaderName = Platform.OS === 'ios' ? 'VoiceOver' : 'TalkBack';

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-6 pt-2 pb-4" style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-200 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#111827" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold" accessibilityRole="header">
            Accessibility
          </Text>
          <Text className="text-gray-500 text-sm mt-0.5">Personalize your experience</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {/* Senior Mode toggle */}
        <SeniorModeToggle />

        {/* Live preview */}
        <Text className="text-gray-700 text-xs font-bold tracking-widest uppercase mb-3 mt-6">
          Live Preview
        </Text>

        <View className="flex-row mb-6" style={{ gap: 12 }}>
          <PreviewCard
            label="Standard"
            tokens={defaultTokens}
            active={!seniorMode}
            onPress={() => setSeniorMode(false)}
          />
          <PreviewCard
            label="Senior"
            tokens={seniorTokens}
            active={seniorMode}
            onPress={() => setSeniorMode(true)}
          />
        </View>

        {/* Text comparison */}
        <Text className="text-gray-700 text-xs font-bold tracking-widest uppercase mb-3">
          How text appears
        </Text>

        <View className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
          <Text className="text-gray-500 text-sm mb-3.5">Tap a column to activate that mode</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            {/* Standard column */}
            <TouchableOpacity
              onPress={() => setSeniorMode(false)}
              accessibilityRole="button"
              accessibilityLabel="Use Standard mode"
              accessibilityState={{ selected: !seniorMode }}
              className={`flex-1 rounded-xl p-3 border ${
                !seniorMode ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold tracking-wider uppercase mb-2 ${
                  !seniorMode ? 'text-primary-500' : 'text-gray-400'
                }`}
              >
                Standard
              </Text>
              <Text className="text-2xl font-bold text-gray-900 mb-1">Aa</Text>
              <Text className="text-gray-700 text-sm leading-5">
                The quick brown fox jumps over the lazy dog.
              </Text>
              <Text className="text-gray-400 text-xs mt-2">14px body · 24px heading</Text>
            </TouchableOpacity>

            {/* Senior column */}
            <TouchableOpacity
              onPress={() => setSeniorMode(true)}
              accessibilityRole="button"
              accessibilityLabel="Use Senior mode"
              accessibilityState={{ selected: seniorMode }}
              className={`flex-1 rounded-xl p-3 border ${
                seniorMode ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold tracking-wider uppercase mb-2 ${
                  seniorMode ? 'text-primary-500' : 'text-gray-400'
                }`}
              >
                Senior
              </Text>
              <Text className="text-3xl font-bold text-gray-900 mb-1">Aa</Text>
              <Text className="text-gray-800 text-lg" style={{ lineHeight: 27 }}>
                The quick brown fox jumps over the lazy dog.
              </Text>
              <Text className="text-gray-400 text-xs mt-2">18px body · 34px heading</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Screen reader info */}
        <Text className="text-gray-700 text-xs font-bold tracking-widest uppercase mb-3">
          Screen Reader
        </Text>

        <View className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
          <View className="flex-row items-start" style={{ gap: 14 }}>
            <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center" style={{ flexShrink: 0 }}>
              <Ionicons name="accessibility" size={22} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-base font-semibold mb-1.5">{screenReaderName}</Text>
              {Platform.OS === 'ios' ? (
                <Text className="text-gray-500 text-sm leading-5">
                  Triple-click the side button to toggle VoiceOver. Swipe right to navigate between elements, double-tap to activate.
                </Text>
              ) : (
                <Text className="text-gray-500 text-sm leading-5">
                  Go to Settings → Accessibility → TalkBack to enable. Swipe right to move between elements, double-tap to activate.
                </Text>
              )}
              <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                <View className="bg-primary-50 rounded-lg px-2.5 py-1">
                  <Text className="text-primary-500 text-xs font-semibold">
                    {Platform.OS === 'ios' ? 'Built into iOS' : 'Built into Android'}
                  </Text>
                </View>
                <View className="bg-green-100 rounded-lg px-2.5 py-1">
                  <Text className="text-green-700 text-xs font-semibold">App fully labelled</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Tip */}
        <View className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <View className="flex-row items-start" style={{ gap: 12 }}>
            <View className="w-9 h-9 rounded-xl bg-primary-50 items-center justify-center" style={{ flexShrink: 0 }}>
              <Ionicons name="eye" size={18} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-base font-semibold mb-1">Tip: Mix and match</Text>
              <Text className="text-gray-500 text-sm leading-5">
                Senior Mode works alongside your phone's built-in accessibility features. Use both together for the best experience.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
