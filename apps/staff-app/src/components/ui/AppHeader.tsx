import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type AppHeaderProps = {
  title: string;
  /** Optional one-liner under the title, rendered in primary-100. */
  subtitle?: string;
  /** Hide the back button on tab roots. Defaults to shown. */
  showBack?: boolean;
  /** Custom back handler; defaults to router.back(). */
  onBack?: () => void;
  /** Optional right-side action slot (button, chip…). */
  right?: ReactNode;
};

/**
 * The one berry screen header. Replaces the divergent back idioms
 * ('‹' glyphs, '← Back' text links, bare titles) across the app.
 */
export function AppHeader({ title, subtitle, showBack = true, onBack, right }: AppHeaderProps) {
  return (
    <View className="bg-primary-500 dark:bg-primary-900 px-5 py-4 flex-row items-center">
      {showBack ? (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      <View className={`flex-1 ${showBack ? 'ml-3' : ''}`}>
        <Text className="font-heading text-white text-lg" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-body text-primary-100 text-xs mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
