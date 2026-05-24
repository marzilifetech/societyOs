import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { ErrorCard } from '../../src/components/ErrorCard';

type VisitorRow = {
  id: string;
  name: string;
  phone?: string;
  purpose?: string;
  approvalStatus?: string;
  status?: string;
  resident?: { name?: string; unit?: { flatNumber?: string; tower?: string } };
  createdAt?: string;
};

export default function VisitorApprovalsScreen() {
  const qc = useQueryClient();

  const { data: visitors = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['staff-visitors-pending'],
    queryFn: () =>
      getUnwrappedArray<VisitorRow>('/staff/visitors?approvalStatus=PENDING'),
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending'] });
    },
    onError: (err: any) => Alert.alert('Could not approve', err?.message ?? 'Try again'),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/staff/visitors/${id}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-visitors-pending'] });
    },
    onError: (err: any) => Alert.alert('Could not reject', err?.message ?? 'Try again'),
  });

  const confirmReject = (visitor: VisitorRow) => {
    Alert.alert('Reject visitor?', `${visitor.name} will not be allowed entry.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => reject.mutate(visitor.id) },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <View className="flex-1 ml-2">
          <Text className="text-white text-lg font-bold">Visitor Approvals</Text>
          <Text className="text-blue-200 text-xs mt-0.5">Pending today</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/scan/qr' as any)}
          className="bg-white/20 rounded-xl px-3 py-2"
        >
          <Text className="text-white text-xs font-semibold">Scan QR</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : isError ? (
        <ErrorCard message="Could not load pending visitors." onRetry={() => refetch()} />
      ) : (
        <ScrollView
          className="flex-1 px-5 pt-4"
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        >
          {visitors.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center mt-4">
              <Text className="text-4xl mb-3">✓</Text>
              <Text className="text-gray-900 font-semibold text-base">No pending approvals</Text>
              <Text className="text-gray-400 text-sm text-center mt-1">
                New visitor requests from residents will appear here.
              </Text>
            </View>
          ) : (
            <View className="gap-3 pb-8">
              {visitors.map((v) => {
                const flat = v.resident?.unit?.flatNumber;
                const tower = v.resident?.unit?.tower;
                const unitLabel = [tower, flat].filter(Boolean).join('-') || '—';
                const busy = approve.isPending || reject.isPending;

                return (
                  <View key={v.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <Text className="text-lg font-bold text-gray-900">{v.name}</Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      Visiting {v.resident?.name ?? 'resident'} · Flat {unitLabel}
                    </Text>
                    {v.purpose ? (
                      <Text className="text-sm text-gray-600 mt-2">{v.purpose}</Text>
                    ) : null}
                    {v.phone ? (
                      <Text className="text-xs text-gray-400 mt-1">{v.phone}</Text>
                    ) : null}

                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        className="flex-1 bg-red-50 border border-red-200 rounded-xl py-3 items-center"
                        disabled={busy}
                        onPress={() => confirmReject(v)}
                      >
                        <Text className="text-red-600 font-semibold text-sm">Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-green-500 rounded-xl py-3 items-center"
                        disabled={busy}
                        onPress={() => approve.mutate(v.id)}
                      >
                        {approve.isPending ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className="text-white font-semibold text-sm">Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
