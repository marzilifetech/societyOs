import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type PestControlSchedule = {
  id: string;
  type: 'MOSQUITO' | 'COCKROACH' | 'RODENT' | 'TERMITE' | 'GENERAL';
  date: string;
  areas: string[];
  status: string;
};

const TYPE_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  MOSQUITO:  { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Mosquito' },
  COCKROACH: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'Cockroach' },
  RODENT:    { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Rodent' },
  TERMITE:   { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Termite' },
  GENERAL:   { bgClass: 'bg-blue-100', textClass: 'text-blue-700', label: 'General' },
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  SCHEDULED:   { bgClass: 'bg-blue-100', textClass: 'text-blue-700', label: 'Scheduled' },
  IN_PROGRESS: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'In Progress' },
  COMPLETED:   { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Completed' },
  CANCELLED:   { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

export default function PestControlScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<PestControlSchedule[]>({
    queryKey: ['pest-control'],
    queryFn: () => api.get<PestControlSchedule[]>('/pest-control'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[48px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Pest Control</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Society-wide schedules</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && [1, 2, 3].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[110px] mb-3" />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load schedules</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="bug" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No upcoming pest control</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Schedules will appear here when announced</Text>
          </View>
        )}

        {data?.map((schedule: PestControlSchedule) => {
          const typeMeta = TYPE_META[schedule.type] ?? TYPE_META.GENERAL;
          const statusMeta = STATUS_META[schedule.status] ?? STATUS_META.SCHEDULED;
          return (
            <View key={schedule.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3">
              <View className="flex-row items-center mb-2">
                <View className="w-9 h-9 rounded-lg bg-primary-50 items-center justify-center mr-2.5">
                  <Ionicons name="bug" size={18} color="#821A52" />
                </View>
                <View className="flex-1 flex-row gap-2">
                  <View className={`${typeMeta.bgClass} rounded-lg px-2.5 py-1`}>
                    <Text className={`${typeMeta.textClass} text-xs font-bold`}>{typeMeta.label}</Text>
                  </View>
                </View>
                <View className={`${statusMeta.bgClass} rounded-lg px-2.5 py-1`}>
                  <Text className={`${statusMeta.textClass} text-xs font-bold`}>{statusMeta.label}</Text>
                </View>
              </View>

              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar" size={14} color="#9CA3AF" />
                <Text className="text-gray-500 text-sm ml-1.5">
                  {new Date(schedule.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {schedule.areas?.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5">
                  {schedule.areas.map((area: string, idx: number) => (
                    <View key={idx} className="bg-white border border-gray-200 rounded-md px-2 py-0.5">
                      <Text className="text-gray-500 text-xs">{area}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
