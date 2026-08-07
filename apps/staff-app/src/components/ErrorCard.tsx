import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { colors } from '@societyos/theme';
import { Button } from './ui/Button';

interface Props {
  message?: string;
  onRetry?: () => void;
  /**
   * The underlying failure, shown small beneath the friendly copy.
   *
   * Without this the screen said only "couldn't be loaded", which is
   * indistinguishable between "you're offline", "your session ended" and
   * "this endpoint is returning 500" — so neither the user nor whoever they
   * call for help can tell whether retrying could ever work.
   */
  detail?: string;
  /** Defaults to "Try Again"; override when retrying is not the real action. */
  retryLabel?: string;
}

export function ErrorCard({ message, onRetry, detail, retryLabel }: Props) {
  const { colorScheme } = useColorScheme();
  const tint = colorScheme === 'dark' ? '#FCA5A5' : colors.error;
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <View className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 items-center justify-center mb-4">
        <Ionicons name="alert-circle-outline" size={30} color={tint} />
      </View>
      <Text className="font-body text-base text-gray-900 dark:text-gray-100 text-center leading-6 mb-5">
        {message ?? "Something didn't load. Please try again."}
      </Text>
      {detail ? (
        <Text className="font-body text-[13px] text-gray-500 dark:text-gray-400 text-center mb-5 px-2">
          {detail}
        </Text>
      ) : null}
      {onRetry && <Button label={retryLabel ?? 'Try Again'} onPress={onRetry} className="mb-4" />}
      <Text className="font-body text-[13px] text-gray-400 dark:text-gray-500 text-center">
        If the problem continues, please inform your supervisor.
      </Text>
    </View>
  );
}
