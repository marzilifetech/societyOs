import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { swallow } from '@societyos/mobile-core';
import { api } from '../../../src/lib/api';
import { AppHeader, Card } from '../../../src/components/ui';
import { QueryScreen } from '../../../src/components/QueryScreen';
import { PhotoPicker } from '../../../src/components/task/PhotoPicker';
import { TaskSummaryCard } from '../../../src/components/task/TaskSummaryCard';
import { usePhotoAttachments } from '../../../src/hooks/usePhotoAttachments';
import { useRefreshTask, useTask } from '../../../src/hooks/useTask';
import { useTimerStore } from '../../../src/store/timer.store';

/** Start work: a before photo is required (BRD 4.5 proof of work). */
export default function StartWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTask(id);
  const refresh = useRefreshTask(id);
  const startTimer = useTimerStore((s) => s.start);
  const before = usePhotoAttachments({
    draftKey: `task:${id}:before`,
    max: 3,
    filenamePrefix: `task-${id}-before`,
  });
  const [busy, setBusy] = useState(false);
  // `busy` only disables the button after a re-render; a fast double tap got
  // in before it and started the work (and posted every proof) twice.
  const submitting = useRef(false);
  /** Proofs the server already has, so a retry after a partial failure skips them. */
  const postedProofs = useRef(new Set<string>());

  const handleStart = async (status: string) => {
    if (submitting.current) return;
    if (before.photos.length === 0) {
      Alert.alert('Photo required', 'Take a before photo of the problem first.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const keys = await before.uploadAll();
      for (const photoUrl of keys) {
        if (postedProofs.current.has(photoUrl)) continue;
        await api.post(`/service-requests/${encodeURIComponent(id)}/proof`, { photoUrl });
        postedProofs.current.add(photoUrl);
      }
      // A retry after a partial failure may find the task already started.
      if (status !== 'IN_PROGRESS') {
        await api.patch(`/service-requests/${encodeURIComponent(id)}/status`, {
          status: 'IN_PROGRESS',
        });
      }
      startTimer(id);
      await before.clearDraft();
      refresh();
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      Alert.alert('Work started', 'Before photo saved. The task is now in progress.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Couldn't start", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <QueryScreen query={query} title="Start work">
      {(task) => (
        <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
          <Stack.Screen options={{ headerShown: false }} />
          <AppHeader title="Start work" />

          <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
            <TaskSummaryCard task={task} />

            <Card padding="lg">
              <Text className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                Before photo
              </Text>
              <Text className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                Required — show the problem before you start.
              </Text>
              <PhotoPicker
                attachments={before}
                label="Tap to take a before photo"
                disabled={busy}
              />
            </Card>

            {task.photos?.length ? (
              <Card padding="lg">
                <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                  Photos on this task
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {task.photos.map((p) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.url }}
                      style={{ width: 120, height: 90, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </Card>
            ) : null}
          </ScrollView>

          <View className="border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
            <TouchableOpacity
              onPress={() => void handleStart(task.status)}
              disabled={busy || before.photos.length === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || before.photos.length === 0, busy }}
              className={`items-center rounded-full py-4 ${
                before.photos.length === 0 ? 'bg-gray-300 dark:bg-gray-700' : 'bg-green-600'
              }`}
              style={{ minHeight: 56 }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-base text-white">Start work</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </QueryScreen>
  );
}
