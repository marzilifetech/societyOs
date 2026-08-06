import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@societyos/theme';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { api } from '../../../src/lib/api';

type VisitorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT_AT_SECURITY';

type VisitorRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  type: 'GUEST' | 'DELIVERY';
  deliveryPartner: string | null;
  approvalStatus: VisitorStatus;
};

const PRIMARY = colors.primary[500];

/**
 * After staff submits an Add Entry, we land here and POLL until the resident
 * decides. Push-back from backend would arrive too, but polling guarantees a
 * snappy UI even if the push is delayed or the device is in doze.
 *
 * Polling cadence is aggressive (2s) only while the row is PENDING. As soon
 * as it transitions out we stop polling and render the outcome.
 */
export default function AwaitingDecisionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: visitor, isLoading } = useQuery({
    queryKey: ['visitor-awaiting', id],
    queryFn: async () => {
      // Staff-scoped endpoint — bypasses the resident-ownership check that
      // /visitors/:id would enforce on a guard.
      const raw = await api.get<object>(`/staff/visitors/${id}`);
      return unwrapApiEnvelope<VisitorRow>(raw);
    },
    enabled: !!id,
    refetchInterval: (q) => {
      const data = q.state.data as VisitorRow | undefined;
      return data?.approvalStatus === 'PENDING' ? 2000 : false;
    },
  });

  // Auto-route back to Home after a final decision lands. Gives the guard a
  // brief moment to read the outcome, then clears the screen — they almost
  // always want to log another entry next.
  useEffect(() => {
    if (!visitor) return;
    if (visitor.approvalStatus === 'PENDING') return;
    const t = setTimeout(() => {
      router.replace('/(tabs)' as any);
    }, 6000);
    return () => clearTimeout(t);
  }, [visitor]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as any)} hitSlop={12}>
          <Ionicons name="close" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text className="ml-2 text-lg font-bold text-gray-900 dark:text-gray-100 flex-1">
          Awaiting resident
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {isLoading || !visitor ? (
          <View className="items-center justify-center py-24">
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <>
            {visitor.photoUrl ? (
              <Image
                source={{ uri: visitor.photoUrl }}
                style={{ width: '100%', height: 280, borderRadius: 16 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 280,
                  borderRadius: 16,
                  backgroundColor: '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={72} color="#9CA3AF" />
              </View>
            )}

            <View className="mt-4">
              <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {visitor.name}
              </Text>
              {visitor.type === 'DELIVERY' && visitor.deliveryPartner ? (
                <View className="self-start mt-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Text className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">
                    {visitor.deliveryPartner}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="mt-8">
              <Outcome status={visitor.approvalStatus} />
            </View>

            {visitor.approvalStatus !== 'PENDING' && (
              <View className="mt-8 gap-3">
                <TouchableOpacity
                  onPress={() => router.replace('/entry/new' as any)}
                  className="rounded-xl items-center py-4"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Text className="text-white font-bold text-base">Add another entry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.replace('/(tabs)' as any)}
                  className="rounded-xl items-center py-3 border border-gray-200 dark:border-gray-700"
                >
                  <Text className="text-gray-700 dark:text-gray-200 font-semibold">
                    Back to home
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Outcome({ status }: { status: VisitorStatus }) {
  if (status === 'PENDING') {
    return (
      <View className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 items-center">
        <ActivityIndicator color={PRIMARY} size="large" />
        <Text className="mt-3 text-base font-bold text-gray-900 dark:text-gray-100">
          Waiting for resident…
        </Text>
        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-center">
          The resident has been alerted. The result will appear here automatically.
        </Text>
      </View>
    );
  }

  const config = {
    APPROVED: {
      icon: 'checkmark-circle' as const,
      color: '#16A34A',
      title: 'Approved',
      sub: 'Let them in.',
      bg: 'bg-green-50 dark:bg-green-950/40',
    },
    LEFT_AT_SECURITY: {
      icon: 'arrow-down-circle' as const,
      color: '#D97706',
      title: 'Leave at security',
      sub: 'Keep the package at the desk for collection.',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    REJECTED: {
      icon: 'close-circle' as const,
      color: '#DC2626',
      title: 'Rejected',
      sub: 'Resident asked to turn them away.',
      bg: 'bg-red-50 dark:bg-red-950/40',
    },
  }[status];

  return (
    <View className={`rounded-2xl p-5 items-center ${config.bg}`}>
      <Ionicons name={config.icon} size={56} color={config.color} />
      <Text className="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100">{config.title}</Text>
      <Text className="mt-1 text-sm text-gray-700 dark:text-gray-300 text-center">{config.sub}</Text>
    </View>
  );
}
