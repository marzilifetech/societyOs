import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../src/lib/api';
import type { HelpRequest } from './index';

const LABELS: Record<string, string> = {
  HELP_HEAVY: 'Heavy item assistance',
  HELP_DOCUMENT: 'Document collection',
  HELP_PACKAGE: 'Package pickup',
};

export default function HelpRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['help-request', id],
    queryFn: async () => {
      try {
        return await api.get<HelpRequest>(`/staff/help-requests/${id}`);
      } catch (e: any) {
        if (__DEV__) console.warn('[help-request detail] fetch failed', e?.message);
        return null;
      }
    },
    enabled: !!id,
  });

  const advance = useMutation({
    mutationFn: async (next: 'IN_PROGRESS' | 'COMPLETED') => {
      if (next === 'COMPLETED') {
        return api.post(`/staff/help-requests/${id}/complete`, {});
      }
      // best-effort accept/in-progress endpoint — fall back if missing
      try {
        return await api.patch(`/staff/help-requests/${id}/status`, { status: next });
      } catch {
        return api.post(`/staff/help-requests/${id}/accept`, {});
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['help-requests'] });
      qc.invalidateQueries({ queryKey: ['help-request', id] });
    },
    onError: (err: any) => Alert.alert('Could not update', err?.message ?? 'Try again'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-primary-500 px-5 py-4 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
            <Text className="text-white text-2xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold ml-2">Help Request</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-500 text-center">Request not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = data.status;
  const isPending = status === 'PENDING' || status === 'ASSIGNED';
  const isInProgress = status === 'IN_PROGRESS';
  const isDone = status === 'COMPLETED';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Help Request</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-xs text-gray-400 uppercase tracking-wider">{LABELS[data.category] ?? data.category}</Text>
          <Text className="text-lg font-semibold text-gray-900 mt-1">
            {data.resident?.name ?? 'Resident'} · Flat {data.resident?.flat ?? '—'}
          </Text>
          <Text className="text-sm text-gray-600 mt-3">{data.description ?? '—'}</Text>
          <Text className="text-xs text-gray-400 mt-3">
            Requested {new Date(data.createdAt).toLocaleString()}
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-5 gap-3">
          <Text className="text-sm font-semibold text-gray-700">Status: {status}</Text>
          {isPending ? (
            <TouchableOpacity
              onPress={() => advance.mutate('IN_PROGRESS')}
              disabled={advance.isPending}
              className="bg-primary-500 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold">Accept & Start</Text>
            </TouchableOpacity>
          ) : null}
          {isInProgress ? (
            <TouchableOpacity
              onPress={() => advance.mutate('COMPLETED')}
              disabled={advance.isPending}
              className="bg-green-600 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold">Mark Complete</Text>
            </TouchableOpacity>
          ) : null}
          {isDone ? (
            <View className="bg-green-50 rounded-xl py-3 items-center">
              <Text className="text-green-700 font-semibold">Completed</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
