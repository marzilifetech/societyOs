import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

const RANGES = ['today', 'week', 'upcoming'] as const;
type Range = typeof RANGES[number];

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Scheduled' },
  COMPLETED: { bg: 'bg-green-100', color: 'text-green-700', label: 'Completed' },
  MISSED: { bg: 'bg-red-100', color: 'text-red-700', label: 'Missed' },
};

export default function ShiftsScreen() {
  const [range, setRange] = useState<Range>('today');
  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts', range],
    queryFn: () => api.get<any[]>(`/staff/shifts?range=${range}`),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'My Shifts' }} />
      <View className="px-6 pt-6 pb-4">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Shifts</Text>
        <View className="flex-row gap-2">
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              className={`px-3 py-1.5 rounded-full border ${
                range === r ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold capitalize ${range === r ? 'text-white' : 'text-gray-600'}`}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : !shifts?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📅</Text>
          <Text className="text-sm text-gray-400">No shifts in this range</Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(s) => s.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const pill = STATUS_PILL[item.status] ?? STATUS_PILL.SCHEDULED;
            const date = new Date(item.date);
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center">
                <View className="bg-blue-50 rounded-xl w-14 items-center py-2 mr-4">
                  <Text className="text-xs text-blue-700 font-semibold">
                    {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </Text>
                  <Text className="text-lg font-bold text-blue-700">{date.getDate()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{item.role ?? 'Shift'}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {item.startTime ?? '--'} – {item.endTime ?? '--'}
                  </Text>
                </View>
                <View className={`rounded-full px-2.5 py-1 ${pill.bg}`}>
                  <Text className={`text-xs font-semibold ${pill.color}`}>{pill.label}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
