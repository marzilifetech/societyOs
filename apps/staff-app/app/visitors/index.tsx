import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@societyos/theme';
import { flatLabel, type ResidentBrief } from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { getUnwrappedArray } from '../../src/lib/unwrapped-get';
import { ErrorCard } from '../../src/components/ErrorCard';
import { AppHeader, Card, EmptyState } from '../../src/components/ui';

/**
 * GET /staff/visitors has sent the resident in two shapes: `user.name` +
 * `flat.{block,number}` (ResidentBrief), and `name` + `unit.{tower,flatNumber}`.
 * Reading only the first rendered "Visiting resident · Flat —" for the other.
 */
type VisitorResident = ResidentBrief & {
  name?: string | null;
  unit?: { tower?: string | null; flatNumber?: string | null } | null;
};

type VisitorRow = {
  id: string;
  name: string;
  phone?: string;
  purpose?: string;
  approvalStatus?: string;
  status?: string;
  resident?: VisitorResident | null;
  createdAt?: string;
};

function residentName(r: VisitorResident | null | undefined): string | null {
  return r?.user?.name || r?.name || null;
}

function residentFlat(r: VisitorResident | null | undefined): string | null {
  return (
    flatLabel(r?.flat) ??
    flatLabel(r?.unit ? { block: r.unit.tower ?? '', number: r.unit.flatNumber ?? '' } : null)
  );
}

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

      <AppHeader
        title="Visitor Approvals"
        subtitle="Pending today"
        right={
          <TouchableOpacity
            onPress={() => router.push('/scan/qr' as any)}
            className="bg-white/20 rounded-full px-3 py-2"
          >
            <Text className="text-white text-xs font-semibold">Scan QR</Text>
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : isError ? (
        <ErrorCard message="Could not load pending visitors." onRetry={() => refetch()} />
      ) : (
        <ScrollView
          className="flex-1 px-5 pt-4"
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        >
          {visitors.length === 0 ? (
            <Card padding="none" className="mt-4">
              <EmptyState
                icon="checkmark-circle-outline"
                title="No pending approvals"
                body="New visitor requests from residents will appear here."
              />
            </Card>
          ) : (
            <View className="gap-3 pb-8">
              {visitors.map((v) => {
                const unitLabel = residentFlat(v.resident) ?? '—';
                const busy = approve.isPending || reject.isPending;
                const approving = approve.isPending && approve.variables === v.id;

                return (
                  <View key={v.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <Text className="text-lg font-bold text-gray-900">{v.name}</Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      Visiting {residentName(v.resident) ?? 'resident'} · Flat {unitLabel}
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
                        {approving ? (
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
