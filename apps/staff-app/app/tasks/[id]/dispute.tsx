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
import { swallow } from '@societyos/mobile-core';
import { api } from '../../../src/lib/api';
import { AppHeader, Card } from '../../../src/components/ui';
import { QueryScreen } from '../../../src/components/QueryScreen';
import { PhotoPicker } from '../../../src/components/task/PhotoPicker';
import { TaskSummaryCard } from '../../../src/components/task/TaskSummaryCard';
import { usePhotoAttachments } from '../../../src/hooks/usePhotoAttachments';
import { useRefreshTask, useTask } from '../../../src/hooks/useTask';

/** Respond to a resident's dispute; goes to the admin with optional evidence photos. */
export default function DisputeResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTask(id);
  const refresh = useRefreshTask(id);
  const evidence = usePhotoAttachments({
    draftKey: `task:${id}:dispute`,
    max: 5,
    filenamePrefix: `task-${id}-dispute`,
  });
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  // `busy` disables the button only after a re-render; a fast double tap got
  // in before it and submitted twice.
  const submitting = useRef(false);

  const handleSubmit = async () => {
    if (submitting.current) return;
    if (!response.trim()) {
      Alert.alert('Response required', 'Describe your response to the dispute.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const photoUrls = await evidence.uploadAll();
      await api.post(`/service-requests/${encodeURIComponent(id)}/dispute-response`, {
        response: response.trim(),
        photoUrls,
      });
      await evidence.clearDraft();
      refresh();
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      Alert.alert('Submitted', 'Your response has been sent to the admin.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Couldn't submit", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <QueryScreen query={query} title="Dispute response">
      {(task) => (
        <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
          <Stack.Screen options={{ headerShown: false }} />
          <AppHeader title="Dispute response" />

          <ScrollView
            className="flex-1"
            contentContainerClassName="p-5 gap-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
              <Text className="mb-2 font-semibold text-xs uppercase tracking-wider text-red-600 dark:text-red-400">
                Resident's dispute
              </Text>
              <Text className="text-sm leading-5 text-red-800 dark:text-red-100">
                {task.disputeReason ?? 'No reason provided.'}
              </Text>
            </View>

            <TaskSummaryCard task={task} showCall={false} />

            <Card padding="lg">
              <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                Your response
              </Text>
              <TextInput
                value={response}
                onChangeText={setResponse}
                placeholder="Explain what was done and address the dispute…"
                placeholderTextColor="#9CA3AF"
                maxLength={1000}
                className="rounded-xl bg-gray-100 p-4 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                style={{ minHeight: 120, textAlignVertical: 'top' }}
                multiline
              />
            </Card>

            <Card padding="lg">
              <Text className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                Evidence photos
              </Text>
              <Text className="mb-4 text-xs text-gray-500 dark:text-gray-400">Optional</Text>
              <PhotoPicker attachments={evidence} label="Tap to add a photo" disabled={busy} />
            </Card>
          </ScrollView>

          <View className="border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              disabled={busy || !response.trim()}
              accessibilityRole="button"
              className={`items-center rounded-full py-4 ${!response.trim() ? 'bg-gray-300 dark:bg-gray-700' : 'bg-amber-600'}`}
              style={{ minHeight: 56 }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-base text-white">Send to admin</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </QueryScreen>
  );
}
