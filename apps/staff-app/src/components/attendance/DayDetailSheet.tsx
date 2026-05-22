import { Modal, View, Text, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../lib/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string | null;
  record: any | null;
};

function fmtTime(iso?: string) {
  if (!iso) return '--:--';
  const lang = i18nInstance.language;
  const loc = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  return new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

export function DayDetailSheet({ visible, onClose, date, record }: Props) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const lang = i18nInstance.language;
  const loc = lang === 'en' ? 'en-IN' : `${lang}-IN`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 border-t border-gray-100 dark:border-gray-800">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {date
                ? new Date(date).toLocaleDateString(loc, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : t('duty.dayFallback')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-400 dark:text-gray-500 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          {!record ? (
            <Text className="text-sm text-gray-400 dark:text-gray-500">{t('duty.noRecordForDay')}</Text>
          ) : (
            <View className="gap-3">
              <Row label={t('duty.checkIn')} value={fmtTime(record.checkIn)} />
              <Row label={t('duty.checkOut')} value={fmtTime(record.checkOut)} />
              {record.checkInLat && (
                <Row label={t('duty.geo')} value={`${record.checkInLat.toFixed(4)}, ${record.checkInLng?.toFixed(4)}`} />
              )}
              {!!record.overtimeMinutes && (
                <Row label={t('duty.overtime')} value={t('duty.overtimeMin', { count: record.overtimeMinutes })} />
              )}
              {record.isLate && record.lateReason && (
                <Row label={t('duty.lateReason')} value={record.lateReason} />
              )}
              {record.photoUrl && (
                <View>
                  <Text className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('duty.checkInPhoto')}</Text>
                  <Image
                    source={{ uri: record.photoUrl }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-xs text-gray-400 dark:text-gray-500">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[200px] text-right">{value}</Text>
    </View>
  );
}
