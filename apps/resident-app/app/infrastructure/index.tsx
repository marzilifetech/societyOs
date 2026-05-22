import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type InfraItem = {
  id: string;
  name: string;
  category: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
  updatedAt: string;
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  OPERATIONAL: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Operational' },
  DEGRADED: { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Degraded' },
  DOWN: { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Down' },
};

export default function InfrastructureScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<InfraItem[]>({
    queryKey: ['infrastructure'],
    queryFn: () => api.get<InfraItem[]>('/infrastructure/status'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Infrastructure</Text>
          <Text className="text-sm text-gray-500 mt-0.5">Society systems status</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 8 }}
      >
        {isLoading && [1, 2, 3, 4].map((i) => (
          <View key={i} className="bg-gray-50 border border-gray-200 rounded-2xl mb-3" style={{ height: 90 }} />
        ))}

        {isError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center mt-4">
            <Text className="text-base text-gray-500 mb-3">Could not load infrastructure status</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center mt-10">
            <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-3">
              <Ionicons name="business" size={32} color="#821A52" />
            </View>
            <Text className="text-lg font-semibold text-gray-900">No infrastructure data</Text>
            <Text className="text-sm text-gray-500 text-center mt-1">Society systems will appear here</Text>
          </View>
        )}

        {data?.map((item: InfraItem) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.OPERATIONAL;
          return (
            <View
              key={item.id}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3"
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center mr-3">
                    <Ionicons name="construct" size={20} color="#821A52" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-gray-900">{item.name}</Text>
                    <View className="flex-row items-center mt-1">
                      <View className="bg-primary-50 rounded-md px-2 py-0.5">
                        <Text className="text-primary-500 text-xs font-semibold">{item.category}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className={`rounded-full px-2.5 py-1 ${meta.bgClass}`}>
                  <Text className={`text-xs font-bold ${meta.textClass}`}>{meta.label}</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-400 mt-2.5">
                Updated {new Date(item.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
