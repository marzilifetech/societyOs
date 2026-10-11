import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { flatLabel } from '@societyos/api-client';
import { swallow } from '@societyos/mobile-core';
import { api } from '../../../src/lib/api';
import { AppHeader, Card } from '../../../src/components/ui';
import { QueryScreen } from '../../../src/components/QueryScreen';
import { PhotoPicker } from '../../../src/components/task/PhotoPicker';
import { usePhotoAttachments } from '../../../src/hooks/usePhotoAttachments';
import {
  HOUSEKEEPING_KEY,
  fetchHousekeepingJob,
  housekeepingTypeLabel,
} from '../../../src/lib/housekeeping';

/** Finish a housekeeping job with before and after photos. */
export default function HousekeepingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['housekeeping', id],
    queryFn: () => fetchHousekeepingJob(id),
    enabled: !!id,
  });
  const before = usePhotoAttachments({ draftKey: `hk:${id}:before`, max: 1, filenamePrefix: `hk-${id}-before` });
  const after = usePhotoAttachments({ draftKey: `hk:${id}:after`, max: 1, filenamePrefix: `hk-${id}-after` });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // `busy` disables the button only after a re-render; a fast double tap got
  // in before it and submitted twice.
  const submitting = useRef(false);
  const ready = before.photos.length > 0 && after.photos.length > 0;

  const handleComplete = async () => {
    if (submitting.current) return;
    if (!ready) {
      Alert.alert('Photos required', 'Take a before and an after photo.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const [[beforePhotoUrl], [afterPhotoUrl]] = await Promise.all([before.uploadAll(), after.uploadAll()]);
      await api.patch(`/housekeeping/${encodeURIComponent(id)}/status`, {
        status: 'COMPLETED',
        beforePhotoUrl,
        afterPhotoUrl,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      await Promise.all([before.clearDraft(), after.clearDraft()]);
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      void qc.invalidateQueries({ queryKey: HOUSEKEEPING_KEY });
      Alert.alert('Done', 'Housekeeping job completed.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert("Couldn't complete", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <QueryScreen query={query} title="Complete housekeeping">
      {(job) => (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
          <Stack.Screen options={{ headerShown: false }} />
          <AppHeader title="Complete housekeeping" />
          <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
            <Card padding="lg">
              <Text className="text-xs uppercase tracking-wider text-gray-400">{housekeepingTypeLabel(job.type)}</Text>
              <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {job.resident?.user?.name ?? 'Resident'}
                {flatLabel(job.resident?.flat) ? ` · Flat ${flatLabel(job.resident?.flat)}` : ''}
              </Text>
              {job.notes ? <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">{job.notes}</Text> : null}
            </Card>
            <Card padding="lg">
              <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Before</Text>
              <PhotoPicker attachments={before} label="Tap to take a before photo" disabled={busy} />
            </Card>
            <Card padding="lg">
              <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">After</Text>
              <PhotoPicker attachments={after} label="Tap to take an after photo" disabled={busy} />
            </Card>
            <Card padding="lg">
              <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything the resident should know…"
                placeholderTextColor="#9CA3AF"
                maxLength={1000}
                className="rounded-xl bg-gray-100 p-4 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                multiline
              />
            </Card>
          </ScrollView>
          <View className="border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
            <TouchableOpacity
              onPress={() => void handleComplete()}
              disabled={busy || !ready}
              accessibilityRole="button"
              className={`items-center rounded-2xl py-4 ${ready ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              style={{ minHeight: 56 }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Mark complete</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </QueryScreen>
  );
}
