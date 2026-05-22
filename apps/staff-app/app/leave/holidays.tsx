import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type Holiday = {
  id: string;
  date: string;
  name: string;
  isOptional?: boolean;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function HolidaysScreen() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [showOptional, setShowOptional] = useState(true);
  const today = new Date();

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () =>
      api
        .get<Holiday[]>(`/staff/holidays?year=${year}`)
        .catch((e) => {
          console.warn('[holidays] fetch failed', e?.message);
          return [] as Holiday[];
        }),
  });

  const filtered = (holidays ?? []).filter((h) => showOptional || !h.isOptional);

  const upcomingCount = useMemo(
    () => filtered.filter((h) => new Date(h.date).getTime() >= today.getTime()).length,
    [filtered, today],
  );

  // Group by month
  const byMonth = useMemo(() => {
    const grouped: Record<number, Holiday[]> = {};
    for (const h of filtered) {
      const m = new Date(h.date).getMonth();
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(h);
    }
    return grouped;
  }, [filtered]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-8">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary-500 text-base mb-4">← Back</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-2xl font-bold text-gray-900">Holidays</Text>
            {upcomingCount > 0 && (
              <View className="bg-primary-500 rounded-full px-2.5 py-1">
                <Text className="text-white text-xs font-semibold">{upcomingCount} upcoming</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 mb-4">Society holiday calendar</Text>

          {/* Year selector */}
          <View className="flex-row gap-2 mb-3">
            {YEARS.map((y) => (
              <TouchableOpacity
                key={y}
                className={`px-3 py-1.5 rounded-full border ${
                  year === y ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
                }`}
                onPress={() => setYear(y)}
              >
                <Text className={`text-xs font-medium ${year === y ? 'text-white' : 'text-gray-600'}`}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional toggle */}
          <TouchableOpacity
            className="flex-row items-center mb-5"
            onPress={() => setShowOptional((v: boolean) => !v)}
          >
            <View
              className={`w-5 h-5 rounded border mr-2 items-center justify-center ${
                showOptional ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-300'
              }`}
            >
              {showOptional && <Text className="text-white text-xs">✓</Text>}
            </View>
            <Text className="text-sm text-gray-700">Show optional holidays</Text>
          </TouchableOpacity>

          {isLoading ? (
            <ActivityIndicator color="#821A52" />
          ) : filtered.length === 0 ? (
            <View className="bg-white rounded-2xl p-6 items-center">
              <Text className="text-4xl mb-2">🎉</Text>
              <Text className="text-gray-400 text-sm">No holidays found</Text>
            </View>
          ) : (
            MONTHS.map((m, idx) => {
              const items = byMonth[idx];
              if (!items?.length) return null;
              return (
                <View key={m} className="mb-4">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">{m} {year}</Text>
                  {items.map((h: Holiday) => {
                    const d = new Date(h.date);
                    const isToday = isSameDay(d, today);
                    return (
                      <View
                        key={h.id}
                        className={`bg-white rounded-2xl p-4 mb-2 flex-row items-center ${
                          isToday ? 'border-2 border-primary-500' : ''
                        }`}
                      >
                        <View className="bg-primary-50 rounded-xl w-12 h-12 items-center justify-center mr-3">
                          <Text className="text-primary-600 font-bold text-base">{d.getDate()}</Text>
                          <Text className="text-primary-500 text-[10px]">{MONTHS[d.getMonth()]}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-gray-900">{h.name}</Text>
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                            {isToday ? ' · Today' : ''}
                          </Text>
                        </View>
                        {h.isOptional && (
                          <View className="bg-amber-100 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-amber-700 font-semibold">Optional</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
