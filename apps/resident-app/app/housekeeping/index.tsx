import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type HousekeepingRequest = {
  id: string;
  type: string;
  scheduledAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  PENDING:     { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Pending' },
  CONFIRMED:   { bgClass: 'bg-blue-100', textClass: 'text-blue-700', label: 'Confirmed' },
  IN_PROGRESS: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'In Progress' },
  COMPLETED:   { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Completed' },
  CANCELLED:   { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function HousekeepingScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<HousekeepingRequest[]>({
    queryKey: ['housekeeping'],
    queryFn: () => api.get<HousekeepingRequest[]>('/housekeeping'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const grouped = STATUS_ORDER.reduce<Record<string, HousekeepingRequest[]>>((acc, s) => {
    const items = (data ?? []).filter((r: HousekeepingRequest) => r.status === s);
    if (items.length > 0) acc[s] = items;
    return acc;
  }, {});

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 min-h-[48px] justify-center">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Housekeeping</Text>
        <TouchableOpacity
          onPress={() => router.push('/housekeeping/new' as any)}
          className="bg-primary-500 rounded-xl px-4 min-h-[48px] justify-center"
        >
          <Text className="text-white font-bold text-sm">+ Book</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && [1, 2, 3].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[90px] mb-3" />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center">
            <Text className="text-gray-500 text-base mb-3">Could not load requests</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="sparkles" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No housekeeping requests</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Tap "+ Book" to schedule a cleaning</Text>
          </View>
        )}

        {Object.entries(grouped).map(([status, items]) => {
          const meta = STATUS_META[status];
          return (
            <View key={status} className="mb-2">
              <View className="flex-row items-center mb-2 mt-4">
                <View className={`${meta.bgClass} rounded-lg px-2.5 py-1`}>
                  <Text className={`${meta.textClass} text-xs font-bold`}>{meta.label.toUpperCase()}</Text>
                </View>
                <Text className="text-gray-400 text-xs ml-2">{items.length}</Text>
              </View>
              {items.map((req) => (
                <View key={req.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-2.5">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center flex-1">
                      <View className="w-9 h-9 rounded-lg bg-primary-50 items-center justify-center mr-3">
                        <Ionicons name="home" size={18} color="#821A52" />
                      </View>
                      <Text className="text-gray-900 text-base font-semibold flex-1">{req.type}</Text>
                    </View>
                    <View className={`${meta.bgClass} rounded-lg px-2.5 py-1`}>
                      <Text className={`${meta.textClass} text-xs font-bold`}>{meta.label}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="calendar" size={14} color="#9CA3AF" />
                    <Text className="text-gray-500 text-sm ml-1.5">
                      {new Date(req.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
