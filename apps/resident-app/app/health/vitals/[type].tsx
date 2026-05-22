import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

type VitalReading = {
  id: string;
  value: string;
  unit: string;
  recordedAt: string;
  notes?: string;
};

type VitalHistory = {
  readings: VitalReading[];
  chart: number[];
  stats: { min: number; max: number; avg: number };
  unit: string;
};

const TYPE_META: Record<string, { label: string; icon: IoniconName; tint: string }> = {
  bp: { label: 'Blood Pressure', icon: 'pulse', tint: '#DC2626' },
  sugar: { label: 'Blood Sugar', icon: 'water', tint: '#0EA5E9' },
  weight: { label: 'Weight', icon: 'scale', tint: '#16A34A' },
  spo2: { label: 'SpO2', icon: 'fitness', tint: '#7C3AED' },
};

function LineChart({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const H = 80;

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
      <Text className="text-gray-500 text-sm mb-3">30-day trend</Text>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {values.map((v, i) => {
          const barH = Math.max(4, ((v - min) / range) * (H - 8));
          const isRecent = i >= values.length - 7;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: barH,
                backgroundColor: isRecent ? '#821A52' : '#821A5255',
                borderRadius: 3,
              }}
            />
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-gray-400 text-xs">30 days ago</Text>
        <Text className="text-gray-400 text-xs">Today</Text>
      </View>
    </View>
  );
}

export default function VitalTypeScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const meta = TYPE_META[type] ?? { label: type, icon: 'pulse' as IoniconName, tint: '#821A52' };

  const { data, isLoading, isError, refetch } = useQuery<VitalHistory>({
    queryKey: ['vitals-history', type],
    queryFn: () => api.get<VitalHistory>(`/health/vitals/${type}?days=30`),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-2"
          style={{ backgroundColor: `${meta.tint}1A` }}
        >
          <Ionicons name={meta.icon} size={20} color={meta.tint} />
        </View>
        <Text className="text-2xl font-bold text-gray-900 flex-1">{meta.label}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && (
          <>
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-24 mb-3" />
            <View className="bg-gray-50 border border-gray-200 rounded-2xl h-16 mb-3" />
          </>
        )}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load history</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <>
            <LineChart values={data.chart} />

            {/* Stats */}
            <View className="flex-row gap-3 mb-6">
              {[
                { label: 'Minimum', value: data.stats.min },
                { label: 'Average', value: data.stats.avg },
                { label: 'Maximum', value: data.stats.max },
              ].map((s) => (
                <View key={s.label} className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center">
                  <Text className="text-gray-900 text-xl font-bold">{s.value}</Text>
                  <Text className="text-gray-400 text-xs mt-1">{data.unit}</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>

            <Text className="text-gray-900 text-lg font-bold mb-3">All Readings</Text>

            {data.readings.length === 0 ? (
              <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
                <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                  <Ionicons name={meta.icon} size={32} color="#821A52" />
                </View>
                <Text className="text-gray-500 text-base">No readings recorded yet</Text>
              </View>
            ) : (
              data.readings.map((r) => (
                <View key={r.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-900 text-xl font-bold">
                      {r.value} <Text className="text-gray-400 text-sm font-normal">{r.unit}</Text>
                    </Text>
                    <Text className="text-gray-500 text-sm">{new Date(r.recordedAt).toLocaleDateString()}</Text>
                  </View>
                  <Text className="text-gray-500 text-sm mt-1">{new Date(r.recordedAt).toLocaleTimeString()}</Text>
                  {r.notes && <Text className="text-gray-500 text-sm mt-2 italic">"{r.notes}"</Text>}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
