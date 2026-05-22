import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../lib/i18n';

export function TaskEmptyState({ titleOverride }: { titleOverride?: string }) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-950/50 items-center justify-center mb-4">
        <Text className="text-5xl">🛠️</Text>
      </View>
      <Text className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1 text-center">
        {titleOverride ?? t('tasks.emptyTitle')}
      </Text>
      <Text className="text-xs text-gray-400 dark:text-gray-500 text-center">
        {t('tasks.emptySubtitle')}
      </Text>
    </View>
  );
}
