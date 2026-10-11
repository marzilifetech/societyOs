import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { swallow } from '@societyos/mobile-core';
import { api } from '../../../src/lib/api';
import { AppHeader, Card } from '../../../src/components/ui';
import { QueryScreen } from '../../../src/components/QueryScreen';
import { PhotoPicker } from '../../../src/components/task/PhotoPicker';
import { TaskSummaryCard } from '../../../src/components/task/TaskSummaryCard';
import { usePhotoAttachments } from '../../../src/hooks/usePhotoAttachments';
import { useRefreshTask, useTask } from '../../../src/hooks/useTask';
import { useTimerStore } from '../../../src/store/timer.store';

const MAX_PHOTOS = 5;

/** Complete work: at least one after photo is required (BRD 4.5 proof of work). */
export default function CompleteWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTask(id);
  const refresh = useRefreshTask(id);
  const stopTimer = useTimerStore((s) => s.stop);
  const after = usePhotoAttachments({
    draftKey: `task:${id}:after`,
    max: MAX_PHOTOS,
    filenamePrefix: `task-${id}-after`,
  });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // `busy` disables the button only after a re-render; a fast double tap got
  // in before it and submitted twice.
  const submitting = useRef(false);
  const [done, setDone] = useState(false);

  const handleComplete = async () => {
    if (submitting.current) return;
    if (after.photos.length === 0) {
      Alert.alert('Photo required', 'Take at least one photo of the finished work.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      // Already-uploaded photos are skipped on a retry (see usePhotoAttachments).
      const photoUrls = await after.uploadAll();
      await api.patch(`/service-requests/${encodeURIComponent(id)}/complete`, {
        photoUrls,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      stopTimer(id);
      await after.clearDraft();
      refresh();
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      setDone(true);
    } catch (e: unknown) {
      Alert.alert("Couldn't complete", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-8 dark:bg-gray-950">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/60">
          <Ionicons name="checkmark-circle" size={48} color="#15803D" />
        </View>
        <Text className="mb-2 text-center font-heading text-2xl text-gray-900 dark:text-gray-100">
          Work completed
        </Text>
        <Text className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Waiting for the resident to confirm. You'll be notified once they do.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-full items-center rounded-full bg-primary-500 px-8 py-4 dark:bg-primary-600"
          style={{ minHeight: 56 }}
        >
          <Text className="font-bold text-base text-white">Back to tasks</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const ready = after.photos.length > 0;

  return (
    <QueryScreen query={query} title="Complete work">
      {(task) => (
        <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-950">
          <Stack.Screen options={{ headerShown: false }} />
          <AppHeader title="Complete work" />

          <ScrollView
            className="flex-1"
            contentContainerClassName="p-5 gap-4"
            keyboardShouldPersistTaps="handled"
          >
            <TaskSummaryCard task={task} />

            <Card padding="lg">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="font-semibold text-gray-900 dark:text-gray-100">After photos</Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  {after.photos.length}/{MAX_PHOTOS}
                </Text>
              </View>
              <Text className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                Required — show the finished work.
              </Text>
              <PhotoPicker attachments={after} label="Tap to take an after photo" disabled={busy} />
            </Card>

            <Card padding="lg">
              <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                Work notes
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Describe what was done…"
                placeholderTextColor="#9CA3AF"
                maxLength={1000}
                className="rounded-xl bg-gray-100 p-4 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                style={{ minHeight: 100, textAlignVertical: 'top' }}
                multiline
              />
            </Card>
          </ScrollView>

          <View className="border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
            <TouchableOpacity
              onPress={() => void handleComplete()}
              disabled={busy || !ready || task.status !== 'IN_PROGRESS'}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !ready, busy }}
              className={`flex-row items-center justify-center rounded-full py-4 ${
                ready ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              style={{ minHeight: 56 }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color={ready ? '#fff' : '#9CA3AF'} />
                  <Text
                    className={`ml-2 font-bold text-base ${ready ? 'text-white' : 'text-gray-400'}`}
                  >
                    {task.status === 'IN_PROGRESS' ? 'Mark complete' : 'Start the task first'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </QueryScreen>
  );
}
