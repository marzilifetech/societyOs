import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { flatLabel, unwrapApiEnvelope, type ResidentBrief } from '@societyos/api-client';
import { api } from '../../../src/lib/api';

type VisitorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT_AT_SECURITY';

type VisitorRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  type: 'GUEST' | 'DELIVERY';
  deliveryPartner: string | null;
  approvalStatus: VisitorStatus;
  resident?: ResidentBrief | null;
};

/** Poll fast at first, slower after 2 min, stop after 15 — the guard can call instead. */
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 5000;
const SLOW_AFTER_MS = 2 * 60_000;
const STOP_AFTER_MS = 15 * 60_000;

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

  const startedAt = useRef(Date.now());
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedLong(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const { data: visitor, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-awaiting', id],
    queryFn: async () => {
      // Staff-scoped endpoint — bypasses the resident-ownership check that
      // /visitors/:id would enforce on a guard.
      const raw = await api.get<object>(`/staff/visitors/${id}`);
      return unwrapApiEnvelope<VisitorRow>(raw);
    },
    enabled: !!id,
    // Keeps polling while there is no answer — including when the first load
    // failed. It used to stop as soon as `data` was undefined, leaving a
    // spinner that never resolved.
    refetchInterval: (q) => {
      const data = q.state.data as VisitorRow | undefined;
      if (data && data.approvalStatus !== 'PENDING') return false;
      const waited = Date.now() - startedAt.current;
      if (waited > STOP_AFTER_MS) return false;
      return waited > SLOW_AFTER_MS ? SLOW_POLL_MS : FAST_POLL_MS;
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
        {!visitor && isError && !isLoading ? (
          <View className="items-center justify-center py-24">
            <Text className="text-center text-gray-600 dark:text-gray-300 mb-4">
              Couldn't check the resident's answer. Check your connection.
            </Text>
            <TouchableOpacity onPress={() => void refetch()} className="rounded-full bg-primary-500 px-6 py-3">
              <Text className="font-semibold text-white">Try again</Text>
            </TouchableOpacity>
          </View>
        ) : !visitor ? (
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

            {visitor.approvalStatus === 'PENDING' && waitedLong && visitor.resident?.user?.phone ? (
              <View className="mt-4 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
                <Text className="text-sm text-amber-900 dark:text-amber-100">
                  No answer yet. Their phone may be off or out of signal — call them instead.
                </Text>
                <TouchableOpacity
                  onPress={() => void Linking.openURL(`tel:${visitor.resident!.user!.phone}`)}
                  accessibilityRole="button"
                  className="mt-3 flex-row items-center justify-center rounded-full bg-green-600 py-3"
                >
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text className="ml-2 font-semibold text-white">
                    Call {visitor.resident.user.name ?? 'resident'}
                    {flatLabel(visitor.resident.flat) ? ` (${flatLabel(visitor.resident.flat)})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

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
