import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { SOS_ACTIVE_KEY, fetchActiveSos, flatLabel, type SosAlertRow } from '../../src/lib/sos';
import { useAuthStore } from '../../src/store/auth.store';
import { AppHeader, Button, Card, EmptyState } from '../../src/components/ui';
import { ErrorCard } from '../../src/components/ErrorCard';

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 1 ? 'just now' : `${mins} min ago`;
}

/**
 * Open SOS alerts for the society, for guards and other responders.
 *
 * This is where an SOS push lands. It used to open the help-request list,
 * which never contains SOS alerts — guards tapped an emergency notification
 * and got an empty screen, and no staff screen could acknowledge an alert.
 *
 * Polls every 10 s while open; the alert a push pointed at (`?focus=`) is
 * pinned to the top.
 */
export default function SosAlertsScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const myId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: SOS_ACTIVE_KEY,
    queryFn: fetchActiveSos,
    refetchInterval: 10_000,
  });

  const alerts = focus
    ? [...data].sort((a, b) => Number(b.id === focus) - Number(a.id === focus))
    : data;

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'acknowledge' | 'resolve' }) =>
      api.patch(`/sos/${encodeURIComponent(id)}/${action}`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: SOS_ACTIVE_KEY }),
    onError: (err: unknown) =>
      Alert.alert('Not saved', err instanceof Error ? err.message : 'Please try again.'),
  });

  const confirmResolve = useCallback(
    (id: string) =>
      Alert.alert('Close this alert?', 'Only close it once the person is safe.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close alert',
          style: 'destructive',
          onPress: () => act.mutate({ id, action: 'resolve' }),
        },
      ]),
    [act],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
      <AppHeader title="Active SOS alerts" subtitle="Respond to emergencies in your society" />
      {isError ? (
        <ErrorCard
          message="Couldn't load SOS alerts."
          detail={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          ListEmptyComponent={
            isLoading ? null : (
              <EmptyState
                icon="shield-checkmark-outline"
                title="No open SOS alerts"
                body="You'll get an alarm notification the moment anyone raises one."
              />
            )
          }
          renderItem={({ item }) => (
            <SosAlertCard
              alert={item}
              focused={item.id === focus}
              mine={item.acknowledgedBy === myId}
              busy={act.isPending && act.variables?.id === item.id}
              onAcknowledge={() => act.mutate({ id: item.id, action: 'acknowledge' })}
              onResolve={() => confirmResolve(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function SosAlertCard({
  alert,
  focused,
  mine,
  busy,
  onAcknowledge,
  onResolve,
}: {
  alert: SosAlertRow;
  focused: boolean;
  mine: boolean;
  busy: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const person = alert.resident;
  const flat = flatLabel(alert);
  const isStaff = person?.role === 'STAFF' || !!person?.staffMember;
  const hasLocation = alert.lat != null && alert.lng != null;
  const active = alert.status === 'ACTIVE';

  return (
    <Card className={focused ? 'border-2 border-red-500' : active ? 'border border-red-300' : ''}>
      <View className="mb-2 flex-row items-center justify-between">
        <View className={`rounded-full px-3 py-1 ${active ? 'bg-red-600' : 'bg-amber-500'}`}>
          <Text className="font-bold text-xs text-white">
            {active ? 'NEEDS HELP' : mine ? 'YOU ARE RESPONDING' : 'SOMEONE IS RESPONDING'}
          </Text>
        </View>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {minutesAgo(alert.createdAt)}
        </Text>
      </View>

      <Text className="font-heading text-lg text-gray-900 dark:text-gray-100">
        {person?.name ?? 'Unknown person'}
      </Text>
      <Text className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
        {isStaff
          ? `Staff${person?.staffMember?.designation ? ` · ${person.staffMember.designation}` : ''}`
          : flat
            ? `Flat ${flat}`
            : 'Resident'}
      </Text>
      {alert.note ? (
        <Text className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-gray-800 dark:bg-amber-950/40 dark:text-gray-200">
          {alert.note}
        </Text>
      ) : null}

      <View className="mt-4 flex-row gap-3">
        {person?.phone ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(`tel:${person.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${person.name ?? 'them'}`}
            className="flex-1 flex-row items-center justify-center rounded-full bg-green-600 py-3"
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text className="ml-2 font-semibold text-white">Call</Text>
          </TouchableOpacity>
        ) : null}
        {hasLocation ? (
          <TouchableOpacity
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${alert.lat},${alert.lng}`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Open location in maps"
            className="flex-1 flex-row items-center justify-center rounded-full border border-gray-300 bg-white py-3 dark:border-gray-600 dark:bg-gray-900"
          >
            <Ionicons name="navigate" size={18} color="#2563EB" />
            <Text className="ml-2 font-semibold text-gray-900 dark:text-gray-100">Directions</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View className="mt-3">
        {active ? (
          <Button
            label="I'm responding"
            onPress={onAcknowledge}
            loading={busy}
            variant="destructive"
          />
        ) : (
          <Button
            label="Mark safe — close alert"
            onPress={onResolve}
            loading={busy}
            variant="secondary"
          />
        )}
      </View>
    </Card>
  );
}
