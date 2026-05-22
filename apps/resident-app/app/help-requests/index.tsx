import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

type HelpRequest = {
  id: string;
  category: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED';
  createdAt: string;
};

const URGENCY_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  LOW:    { bgClass: 'bg-gray-100', textClass: 'text-gray-500', label: 'Low' },
  MEDIUM: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'Medium' },
  HIGH:   { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'High' },
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  OPEN:     { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Open' },
  ASSIGNED: { bgClass: 'bg-blue-100', textClass: 'text-blue-700', label: 'Assigned' },
  RESOLVED: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Resolved' },
};

export default function HelpRequestsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<HelpRequest[]>({
    queryKey: ['help-requests'],
    queryFn: () => api.get<HelpRequest[]>('/help-requests'),
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
        <Text className="text-2xl font-bold text-gray-900 flex-1">Help Requests</Text>
        <TouchableOpacity
          onPress={() => router.push('/help-requests/new' as any)}
          className="bg-primary-500 rounded-2xl px-4 py-2.5 min-h-[48px] justify-center"
        >
          <Text className="text-white font-bold text-sm">+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {isLoading && (
          <SkeletonPlaceholder count={3} height={110} className="bg-gray-50" borderRadius={20} />
        )}

        {isError && (
          <View className="bg-gray-50 rounded-2xl border border-gray-200 p-6 items-center mt-4">
            <Text className="text-gray-500 text-base mb-3">Could not load help requests</Text>
            <TouchableOpacity onPress={() => refetch()} className="bg-primary-500 rounded-2xl px-6 py-3 min-h-[48px] justify-center">
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="help-circle" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No help requests</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Tap + New to submit a request to staff</Text>
          </View>
        )}

        {data?.map((item: HelpRequest) => {
          const urgency = URGENCY_META[item.urgency] ?? URGENCY_META.LOW;
          const status = STATUS_META[item.status] ?? STATUS_META.OPEN;
          return (
            <View key={item.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3">
              <View className="flex-row items-center mb-2 gap-2">
                <View className="bg-primary-50 rounded-lg px-2.5 py-1">
                  <Text className="text-primary-500 text-xs font-bold">{item.category}</Text>
                </View>
                <View className={`${urgency.bgClass} rounded-lg px-2.5 py-1`}>
                  <Text className={`${urgency.textClass} text-xs font-bold`}>{urgency.label}</Text>
                </View>
                <View className="flex-1" />
                <View className={`${status.bgClass} rounded-lg px-2.5 py-1`}>
                  <Text className={`${status.textClass} text-xs font-bold`}>{status.label}</Text>
                </View>
              </View>
              <Text className="text-gray-900 text-base leading-5" numberOfLines={2}>{item.description}</Text>
              <Text className="text-gray-400 text-xs mt-2">
                {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
