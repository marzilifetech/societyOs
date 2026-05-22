import { useTheme } from '../../src/hooks/useTheme';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ConciergeRequest = {
  id: string;
  service: string;
  description: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  rating?: number;
};

const STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  PENDING:     { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Pending' },
  IN_PROGRESS: { bgClass: 'bg-orange-100', textClass: 'text-orange-700', label: 'In Progress' },
  COMPLETED:   { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Completed' },
  CANCELLED:   { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

const SERVICE_ICONS: Record<string, IoniconName> = {
  'Car Booking': 'car',
  'Airport Transfer': 'airplane',
  'Errand': 'cube',
  'Restaurant Booking': 'restaurant',
  'Delivery Collection': 'mail',
  'Other': 'notifications',
};

export default function ConciergeScreen() {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<ConciergeRequest[]>({
    queryKey: ['concierge-requests'],
    queryFn: () => api.get<ConciergeRequest[]>('/concierge/my'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const active = data?.filter((r: any) => r.status === 'PENDING' || r.status === 'IN_PROGRESS') ?? [];
  const history = data?.filter((r: any) => r.status === 'COMPLETED' || r.status === 'CANCELLED') ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="min-h-[52px] justify-center mr-3">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Concierge</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Personal assistance services</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/concierge/new' as any)}
          className="min-h-[52px] justify-center bg-primary-500 rounded-2xl px-4"
        >
          <Text className="text-white font-bold text-sm">+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {isLoading && [1, 2, 3].map((i: any) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[100px] mb-3" />
        ))}

        {isError && (
          <ErrorCard
            message="Your concierge requests couldn't be loaded. Please try again — your requests are safe."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <View className="items-center mt-12 px-6">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="notifications" size={32} color="#821A52" />
            </View>
            <Text className="text-gray-900 font-semibold text-lg">No requests yet</Text>
            <Text className="text-gray-400 text-sm text-center mt-2">Tap + New to request concierge assistance</Text>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-2">ACTIVE REQUESTS</Text>
            {active.map((r: any) => <RequestCard key={r.id} request={r} icons={SERVICE_ICONS} />)}
          </>
        )}

        {history.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold mb-2.5 mt-4">HISTORY</Text>
            {history.map((r: any) => <RequestCard key={r.id} request={r} icons={SERVICE_ICONS} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestCard({ request, icons }: { request: ConciergeRequest; icons: Record<string, IoniconName> }) {
  const meta = STATUS_META[request.status] ?? STATUS_META.PENDING;
  const iconName = icons[request.service] ?? 'notifications';
  return (
    <View className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-2.5">
      <View className="flex-row items-start">
        <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center mr-3">
          <Ionicons name={iconName} size={22} color="#821A52" />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <Text className="text-gray-900 text-base font-bold flex-1 mr-2">{request.service}</Text>
            <View className={`${meta.bgClass} rounded-lg px-2.5 py-1`}>
              <Text className={`${meta.textClass} text-xs font-bold`}>{meta.label}</Text>
            </View>
          </View>
          <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>{request.description}</Text>
          {request.scheduledAt && (
            <View className="flex-row items-center mt-1.5">
              <Ionicons name="time" size={13} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs ml-1">
                {new Date(request.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
          {request.rating && (
            <Text className="text-amber-500 text-sm mt-1">{'★'.repeat(request.rating)}{'☆'.repeat(5 - request.rating)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}
