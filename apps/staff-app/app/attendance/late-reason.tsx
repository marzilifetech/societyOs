import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { VoiceNoteRecorder } from '../../src/components/task/VoiceNoteRecorder';
import { uploadMediaAndGetKey } from '../../src/lib/photo-upload';

export default function LateReasonScreen() {
  const [reason, setReason] = useState('');
  const [voiceUri, setVoiceUri] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      let voiceUrl: string | null = null;
      if (voiceUri) {
        try {
          voiceUrl = await uploadMediaAndGetKey(voiceUri, {
            contentType: 'audio/m4a',
            filename: `late-reason-${Date.now()}.m4a`,
            // A voice note about being late is personal; keep it off the CDN.
            visibility: 'private',
          });
        } catch (e) {
          // The reason itself still submits without the recording.
          console.warn('voice upload failed', e);
        }
      }
      return api.post('/staff/check-in/late-reason', { reason, voiceUrl });
    },
    onSuccess: () => {
      Alert.alert('Submitted', 'Your late reason has been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Late Reason' }} />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-2xl font-bold text-gray-900 mb-1">Late Arrival</Text>
        <Text className="text-sm text-gray-500 mb-6">
          Tell your supervisor why you're late today.
        </Text>

        <Text className="text-xs font-semibold text-gray-500 mb-2">Reason (required)</Text>
        <TextInput
          multiline
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Heavy traffic on main road"
          className="bg-white rounded-2xl p-4 text-sm text-gray-900 shadow-sm"
          style={{ textAlignVertical: 'top', minHeight: 120 }}
        />

        <View className="mt-5">
          <Text className="text-xs font-semibold text-gray-500 mb-2">Or record a voice note</Text>
          <VoiceNoteRecorder onRecorded={setVoiceUri} />
          {voiceUri && (
            <Text className="text-xs text-green-700 mt-2">✓ Voice note attached</Text>
          )}
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mt-8 ${reason.trim().length < 5 ? 'bg-gray-300' : 'bg-primary-500'}`}
          disabled={reason.trim().length < 5 || submit.isPending}
          onPress={() => submit.mutate()}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold">Submit Reason</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
