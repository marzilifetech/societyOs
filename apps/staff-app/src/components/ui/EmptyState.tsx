import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { colors } from '@societyos/theme';

type EmptyStateProps = {
  /** Ionicons glyph, e.g. "megaphone-outline". */
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  className?: string;
};

/** Tinted-circle Ionicon + heading + body — replaces the ad-hoc emoji empty states. */
export function EmptyState({ icon = 'file-tray-outline', title, body, className = '' }: EmptyStateProps) {
  const { colorScheme } = useColorScheme();
  const tint = colorScheme === 'dark' ? colors.primary[200] : colors.primary[500];
  return (
    <View className={`items-center px-8 py-10 ${className}`}>
      <View className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mb-4">
        <Ionicons name={icon} size={28} color={tint} />
      </View>
      <Text className="font-heading text-base text-gray-900 dark:text-gray-100 text-center">{title}</Text>
      {body ? (
        <Text className="font-body text-sm text-gray-500 dark:text-gray-400 text-center mt-1.5">
          {body}
        </Text>
      ) : null}
    </View>
  );
}
