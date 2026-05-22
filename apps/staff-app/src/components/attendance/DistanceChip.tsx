import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../lib/i18n';

type Props = {
  meters: number | null;
  inside: boolean;
};

export function DistanceChip({ meters, inside }: Props) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });

  if (meters == null) return null;
  if (inside) {
    return (
      <View className="bg-green-100 dark:bg-green-950/60 rounded-full px-3 py-1 self-start">
        <Text className="text-xs font-semibold text-green-700 dark:text-green-400">{t('duty.distanceInSociety')}</Text>
      </View>
    );
  }
  const dist =
    meters > 999 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  return (
    <View className="bg-amber-100 dark:bg-amber-950/60 rounded-full px-3 py-1 self-start">
      <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
        {t('duty.distanceAway', { distance: dist })}
      </Text>
    </View>
  );
}
