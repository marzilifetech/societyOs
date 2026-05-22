import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../lib/i18n';

type AttRecord = {
  id: string;
  date: string;
  status?: string;
  isLate?: boolean;
};

type Props = {
  month: number; // 1-12
  year: number;
  records: AttRecord[];
  onTapDay: (date: string, record?: AttRecord) => void;
};

function weekdayNarrowHeaders(): string[] {
  const lang = i18nInstance.language;
  const loc = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const fmt = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
}

const STATUS_BG: Record<string, string> = {
  PRESENT: 'bg-green-100 dark:bg-green-950/70',
  LATE: 'bg-amber-100 dark:bg-amber-950/70',
  ABSENT: 'bg-red-100 dark:bg-red-950/70',
  HALF_DAY: 'bg-amber-100 dark:bg-amber-950/70',
  ON_LEAVE: 'bg-blue-100 dark:bg-blue-950/70',
  HOLIDAY: 'bg-purple-100 dark:bg-purple-950/70',
};
const STATUS_TEXT: Record<string, string> = {
  PRESENT: 'text-green-700 dark:text-green-400',
  LATE: 'text-amber-700 dark:text-amber-400',
  ABSENT: 'text-red-700 dark:text-red-400',
  HALF_DAY: 'text-amber-700 dark:text-amber-400',
  ON_LEAVE: 'text-blue-700 dark:text-blue-400',
  HOLIDAY: 'text-purple-700 dark:text-purple-400',
};

export function MonthGrid({ month, year, records, onTapDay }: Props) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const dowLabels = weekdayNarrowHeaders();
  const recordList = Array.isArray(records) ? records : [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const recordByDay: { [day: number]: AttRecord } = {};
  for (const r of recordList) {
    const d = new Date(r.date);
    if (d.getMonth() + 1 === month && d.getFullYear() === year) {
      recordByDay[d.getDate()] = r;
    }
  }

  return (
    <View>
      <View className="flex-row mb-2">
        {dowLabels.map((d, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-xs text-gray-400 dark:text-gray-500 font-semibold">{d}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={idx} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5" />;
          }
          const rec = recordByDay[day];
          const status = rec?.isLate ? 'LATE' : rec?.status;
          const bg = status ? STATUS_BG[status] ?? 'bg-gray-50 dark:bg-gray-800/80' : 'bg-gray-50 dark:bg-gray-800/80';
          const txt = status ? STATUS_TEXT[status] ?? 'text-gray-500 dark:text-gray-400' : 'text-gray-500 dark:text-gray-400';
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <View key={idx} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5">
              <TouchableOpacity
                className={`flex-1 rounded-xl items-center justify-center ${bg}`}
                onPress={() => onTapDay(dateStr, rec)}
              >
                <Text className={`text-xs font-semibold ${txt}`}>{day}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <View className="flex-row flex-wrap gap-3 mt-3">
        <Legend color="bg-green-200 dark:bg-green-900" label={t('duty.legendPresent')} />
        <Legend color="bg-amber-200 dark:bg-amber-900" label={t('duty.legendLate')} />
        <Legend color="bg-red-200 dark:bg-red-900" label={t('duty.legendAbsent')} />
        <Legend color="bg-blue-200 dark:bg-blue-900" label={t('duty.legendLeave')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`w-3 h-3 rounded ${color}`} />
      <Text className="text-[10px] text-gray-500 dark:text-gray-400">{label}</Text>
    </View>
  );
}
