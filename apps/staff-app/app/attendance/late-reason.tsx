import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { AppHeader } from '../../src/components/ui';

const MIN_LENGTH = 5;

/**
 * Why the guard was late today, for their supervisor.
 *
 * The voice-note option is gone: it called an audio API that does not exist in
 * expo-audio (so it never recorded), the media service accepts no audio, and
 * the server discarded the recording anyway. A typed reason always worked.
 */
export default function LateReasonScreen() {
  const [reason, setReason] = useState('');

  const submit = useMutation({
    mutationFn: () => api.post('/staff/check-in/late-reason', { reason: reason.trim() }),
    onSuccess: () => {
      Alert.alert('Submitted', 'Your reason has been sent to your supervisor.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) =>
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : 'Please try again.'),
  });

  const ready = reason.trim().length >= MIN_LENGTH;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Late arrival" />
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Tell your supervisor why you were late today.
        </Text>

        <Text className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Reason</Text>
        <TextInput
          multiline
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          placeholder="e.g. Heavy traffic on the main road"
          placeholderTextColor="#9CA3AF"
          accessibilityLabel="Reason for being late"
          className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
          style={{ textAlignVertical: 'top', minHeight: 120 }}
        />

        <TouchableOpacity
          className={`mt-8 items-center rounded-2xl py-4 ${ready ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}
          disabled={!ready || submit.isPending}
          onPress={() => submit.mutate()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || submit.isPending, busy: submit.isPending }}
          style={{ minHeight: 56 }}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-bold text-white">Send reason</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
