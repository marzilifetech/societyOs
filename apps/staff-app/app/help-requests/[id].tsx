import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { flatLabel } from '@societyos/api-client';
import { swallow } from '@societyos/mobile-core';
import { api } from '../../src/lib/api';
import { AppHeader, Button, Card } from '../../src/components/ui';
import { QueryScreen } from '../../src/components/QueryScreen';
import {
  HELP_REQUESTS_KEY,
  fetchHelpRequest,
  helpRequestKey,
  helpTypeLabel,
  isUnclaimed,
} from '../../src/lib/help-requests';

type Action = 'accept' | 'decline' | 'start';

export default function HelpRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: helpRequestKey(id),
    queryFn: () => fetchHelpRequest(id),
    enabled: !!id,
  });

  const act = useMutation({
    mutationFn: (action: Action) => {
      const base = `/staff/help-requests/${encodeURIComponent(id)}`;
      if (action === 'start') return api.patch(`${base}/status`, { status: 'IN_PROGRESS' });
      return api.post(`${base}/${action}`, {});
    },
    onSuccess: (_d, action) => {
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      void qc.invalidateQueries({ queryKey: HELP_REQUESTS_KEY });
      if (action === 'decline') {
        router.back();
        return;
      }
      void qc.invalidateQueries({ queryKey: helpRequestKey(id) });
    },
    onError: (err: unknown) =>
      Alert.alert('Not saved', err instanceof Error ? err.message : 'Please try again.'),
  });

  return (
    <QueryScreen query={query} title="Help request">
      {(r) => {
        const name = r.resident?.user?.name ?? 'Resident';
        const phone = r.resident?.user?.phone;
        const flat = flatLabel(r.resident?.flat);
        const open = isUnclaimed(r);
        const mine = !!r.assignedStaffId;
        const busy = act.isPending;
        return (
          <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <AppHeader title="Help request" />
            <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
              <Card padding="lg">
                <Text className="text-xs uppercase tracking-wider text-gray-400">{helpTypeLabel(r.type)}</Text>
                <Text className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {name}
                  {flat ? ` · Flat ${flat}` : ''}
                </Text>
                <Text className="mt-3 text-sm leading-5 text-gray-600 dark:text-gray-300">{r.description}</Text>
                <Text className="mt-3 text-xs text-gray-400">
                  Requested {new Date(r.createdAt).toLocaleString('en-IN')}
                </Text>
                {phone && mine ? (
                  <TouchableOpacity
                    onPress={() => void Linking.openURL(`tel:${phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${name}`}
                    className="mt-4 flex-row items-center justify-center rounded-full bg-green-600 py-3"
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text className="ml-2 font-semibold text-white">Call {name}</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>

              <Card padding="lg" className="gap-3">
                {open ? (
                  <Button label="I'll do it" onPress={() => act.mutate('accept')} loading={busy} />
                ) : null}
                {mine && (r.status === 'ASSIGNED' || r.status === 'ACCEPTED') ? (
                  <Button label="Start now" onPress={() => act.mutate('start')} loading={busy} />
                ) : null}
                {mine && r.status === 'IN_PROGRESS' ? (
                  <Button
                    label="Mark complete"
                    onPress={() => router.push(`/help-requests/${r.id}/complete` as never)}
                  />
                ) : null}
                {mine && r.status !== 'COMPLETED' ? (
                  <Button
                    label="I can't do this — give it back"
                    variant="secondary"
                    onPress={() => act.mutate('decline')}
                    disabled={busy}
                  />
                ) : null}
                {r.status === 'COMPLETED' ? (
                  <View className="items-center rounded-xl bg-green-50 py-3 dark:bg-green-950/40">
                    <Text className="font-semibold text-green-700 dark:text-green-300">Completed</Text>
                  </View>
                ) : null}
              </Card>
            </ScrollView>
          </SafeAreaView>
        );
      }}
    </QueryScreen>
  );
}
