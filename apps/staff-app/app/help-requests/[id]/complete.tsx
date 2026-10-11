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
  HELP_REQUESTS_KEY,
  fetchHelpRequest,
  helpRequestKey,
  helpTypeLabel,
} from '../../../src/lib/help-requests';

/** Finish a help request with a proof photo and notes; the resident is notified to rate it. */
export default function HelpRequestCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: helpRequestKey(id),
    queryFn: () => fetchHelpRequest(id),
    enabled: !!id,
  });
  const proof = usePhotoAttachments({ draftKey: `help:${id}:done`, max: 1, filenamePrefix: `help-${id}` });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // `busy` disables the button only after a re-render; a fast double tap got
  // in before it and submitted twice.
  const submitting = useRef(false);

  const handleComplete = async () => {
    if (submitting.current) return;
    if (proof.photos.length === 0) {
      Alert.alert('Photo required', 'Take a photo showing the job is done.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const [photoUrl] = await proof.uploadAll();
      await api.post(`/staff/help-requests/${encodeURIComponent(id)}/complete`, {
        photoUrl,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      await proof.clearDraft();
      void swallow(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      void qc.invalidateQueries({ queryKey: HELP_REQUESTS_KEY });
      void qc.invalidateQueries({ queryKey: helpRequestKey(id) });
      Alert.alert('Done', 'The resident has been told and can rate your help.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Couldn't complete", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <QueryScreen query={query} title="Complete help request">
      {(r) => {
        const flat = flatLabel(r.resident?.flat);
        const ready = proof.photos.length > 0;
        return (
          <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <AppHeader title="Complete help request" />
            <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
              <Card padding="lg">
                <Text className="mb-1 text-xs uppercase tracking-wider text-gray-400">{helpTypeLabel(r.type)}</Text>
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {r.resident?.user?.name ?? 'Resident'}
                  {flat ? ` · Flat ${flat}` : ''}
                </Text>
                <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">{r.description}</Text>
              </Card>

              <Card padding="lg">
                <Text className="mb-1 font-semibold text-gray-900 dark:text-gray-100">Completion photo</Text>
                <Text className="mb-4 text-xs text-gray-500 dark:text-gray-400">Required — show the job is done.</Text>
                <PhotoPicker attachments={proof} label="Tap to take a photo" disabled={busy} />
              </Card>

              <Card padding="lg">
                <Text className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="What was done…"
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
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-bold text-white">Mark complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        );
      }}
    </QueryScreen>
  );
}
