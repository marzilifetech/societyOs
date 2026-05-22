import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type Package = {
  id: string;
  courier: string;
  trackingNumber: string;
  status: 'ARRIVED' | 'COLLECTED';
  arrivedAt: string;
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  ARRIVED:   { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'Arrived' },
  COLLECTED: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Collected' },
};

export default function PackagesScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => api.get<Package[]>('/packages/my'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Packages</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Your deliveries</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && [1, 2, 3].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[100px] mb-3" />
        ))}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center mt-4">
            <Text className="text-gray-500 text-base mb-3">Could not load packages</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="cube" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No packages pending</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Packages received at the gate will appear here</Text>
          </View>
        )}

        {data?.map((pkg: Package) => {
          const meta = STATUS_META[pkg.status] ?? STATUS_META.ARRIVED;
          return (
            <View key={pkg.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3">
              <View className="flex-row items-start">
                <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center mr-3">
                  <Ionicons name="cube" size={22} color="#821A52" />
                </View>
                <View className="flex-1 mr-2">
                  <View className="flex-row justify-between items-start">
                    <Text className="text-gray-900 text-base font-bold flex-1 mr-2">{pkg.courier}</Text>
                    <View className={`${meta.bgClass} rounded-lg px-2.5 py-1`}>
                      <Text className={`${meta.textClass} text-xs font-bold`}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'monospace' }}>{pkg.trackingNumber}</Text>
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="time" size={12} color="#9CA3AF" />
                    <Text className="text-gray-400 text-xs ml-1">
                      Arrived {new Date(pkg.arrivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
