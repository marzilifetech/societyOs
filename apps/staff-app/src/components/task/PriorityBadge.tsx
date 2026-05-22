import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../lib/i18n';

type Props = {
  createdAt?: string;
  slaHours?: number;
  status?: string;
};

export function PriorityBadge({ createdAt, slaHours = 24, status }: Props) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });

  if (!createdAt || status === 'COMPLETED' || status === 'REJECTED') return null;
  const ageHrs = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  if (ageHrs > slaHours) {
    return (
      <View className="bg-red-100 dark:bg-red-950/60 rounded-full px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-red-700 dark:text-red-400">{t('tasks.slaBreach')}</Text>
      </View>
    );
  }
  if (ageHrs > slaHours * 0.75) {
    return (
      <View className="bg-amber-100 dark:bg-amber-950/60 rounded-full px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t('tasks.atRisk')}</Text>
      </View>
    );
  }
  return null;
}
