import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { DistanceChip } from '../../src/components/attendance/DistanceChip';
import { MonthGrid } from '../../src/components/attendance/MonthGrid';
import { DayDetailSheet } from '../../src/components/attendance/DayDetailSheet';
import { SkeletonCard } from '../../src/components/attendance/SkeletonCard';
import { useAttendance } from '../../src/hooks/useAttendance';

function localeTag(lang: string) {
  return lang === 'en' ? 'en-IN' : `${lang}-IN`;
}

export default function AttendanceScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const [sheetRecord, setSheetRecord] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  /** Check-in is the default focus; calendar is for history only (expand to view). */
  const [monthCalendarOpen, setMonthCalendarOpen] = useState(false);

  const {
    todayRecord,
    todayPending,
    history,
    historyLoading,
    distance,
    insideGeofence,
    checkedIn,
    checkedOut,
    checkIn,
    checkOut,
    isCheckingIn,
    isCheckingOut,
  } = useAttendance(month, year, monthCalendarOpen);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const monthLabel = new Date(year, month - 1).toLocaleDateString(localeTag(i18nInstance.language), {
    month: 'long',
    year: 'numeric',
  });

  const downloadCsv = () => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
    const url = `${base}/staff/attendance.csv?month=${month}&year=${year}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(t('duty.csvDownloadFailTitle'), t('duty.csvDownloadFailBody')),
    );
  };

  const onTapDay = (date: string, record?: any) => {
    setSheetDay(date);
    setSheetRecord(record ?? null);
    setSheetVisible(true);
  };

  const loc = localeTag(i18nInstance.language);
  const todayDateStr = today.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('tabs.duty')}</Text>
            <TouchableOpacity
              onPress={() => router.push('/attendance/shifts' as any)}
              className="bg-white dark:bg-gray-900 rounded-full px-3 py-1.5 border border-transparent dark:border-gray-800"
            >
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('duty.shifts')}</Text>
            </TouchableOpacity>
          </View>

          {/* Today card — always the primary action; not the monthly calendar */}
          {todayPending ? (
            <SkeletonCard height={180} />
          ) : (
            <View className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm mb-4 border border-transparent dark:border-gray-800">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {t('duty.todayLine', { date: todayDateStr })}
              </Text>

              <View className="flex-row gap-4 mb-4">
                <TimeBlock
                  label={t('duty.checkIn')}
                  time={
                    todayRecord?.checkIn
                      ? new Date(todayRecord.checkIn).toLocaleTimeString(loc, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'
                  }
                  late={todayRecord?.isLate}
                />
                <TimeBlock
                  label={t('duty.checkOut')}
                  time={
                    todayRecord?.checkOut
                      ? new Date(todayRecord.checkOut).toLocaleTimeString(loc, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'
                  }
                  early={todayRecord?.isEarlyDeparture}
                />
              </View>

              {!checkedIn && (
                <View className="gap-3">
                  <DistanceChip meters={distance} inside={insideGeofence} />
                  <TouchableOpacity
                    className={`rounded-2xl py-4 items-center ${insideGeofence ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onPress={checkIn}
                    disabled={isCheckingIn || !insideGeofence}
                  >
                    {isCheckingIn ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold text-base">{t('duty.markCheckIn')}</Text>
                    )}
                  </TouchableOpacity>
                  {todayRecord?.isLate && (
                    <TouchableOpacity
                      onPress={() => router.push('/attendance/late-reason' as any)}
                      className="self-center"
                    >
                      <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {t('duty.submitLateReason')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {checkedIn && !checkedOut && (
                <TouchableOpacity
                  className="bg-red-500 dark:bg-red-600 rounded-2xl py-4 items-center"
                  onPress={() =>
                    Alert.alert(t('duty.checkOutTitle'), t('duty.checkOutConfirm'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('duty.checkOut'),
                        style: 'destructive',
                        onPress: checkOut,
                      },
                    ])
                  }
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">{t('duty.markCheckOut')}</Text>
                  )}
                </TouchableOpacity>
              )}

              {checkedIn && checkedOut && (
                <View className="bg-green-50 dark:bg-green-950/50 rounded-2xl py-4 items-center border border-green-100 dark:border-green-900">
                  <Text className="text-green-600 dark:text-green-400 font-bold text-base">{t('duty.attendanceMarked')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Month grid: secondary — avoid implying check-in requires picking a date */}
          <TouchableOpacity
            className="flex-row items-center justify-between bg-white dark:bg-gray-900 rounded-2xl px-4 py-3.5 shadow-sm mt-2 border border-transparent dark:border-gray-800"
            onPress={() => setMonthCalendarOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: monthCalendarOpen }}
          >
            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('duty.monthlyCalendar')}</Text>
            <Text className="text-gray-400 dark:text-gray-500 text-lg">{monthCalendarOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {monthCalendarOpen && (
            <>
              <View className="flex-row items-center justify-between mb-3 mt-4">
                <TouchableOpacity onPress={prevMonth} className="p-2">
                  <Text className="text-gray-400 dark:text-gray-500 text-xl">‹</Text>
                </TouchableOpacity>
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">{monthLabel}</Text>
                <TouchableOpacity onPress={nextMonth} className="p-2">
                  <Text className="text-gray-400 dark:text-gray-500 text-xl">›</Text>
                </TouchableOpacity>
              </View>

              {historyLoading ? (
                <SkeletonCard height={260} />
              ) : (
                <View className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-transparent dark:border-gray-800">
                  <MonthGrid
                    month={month}
                    year={year}
                    records={history}
                    onTapDay={onTapDay}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={downloadCsv}
                className="bg-white dark:bg-gray-900 rounded-2xl py-3 items-center mt-4 shadow-sm border border-transparent dark:border-gray-800"
              >
                <Text className="text-sm font-semibold text-primary-500 dark:text-primary-400">{t('duty.downloadCsv')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <DayDetailSheet
        visible={sheetVisible}
        date={sheetDay}
        record={sheetRecord}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

function TimeBlock({
  label,
  time,
  late,
  early,
}: {
  label: string;
  time: string;
  late?: boolean;
  early?: boolean;
}) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-800/80 rounded-xl p-3">
      <Text className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</Text>
      <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{time}</Text>
      {late && <Text className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t('duty.late')}</Text>}
      {early && <Text className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t('duty.earlyDeparture')}</Text>}
    </View>
  );
}
