import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors } from '@societyos/theme';
import { api } from '../../../src/lib/api';
import { compressImage, uploadToPresigned } from '../../../src/lib/upload';
import { AppHeader, Card } from '../../../src/components/ui';

export default function DisputeResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [response, setResponse] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
    enabled: !!id,
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, { maxWidth: 1200 });
      setPhotos((p) => [...p, compressed]);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const photoUrls: string[] = [];
      for (const uri of photos) {
        const presign = await api.get<{ url: string; key: string }>(
          `/service-requests/${id}/photo-upload-url?phase=DISPUTE`,
        );
        await uploadToPresigned(presign.url, uri, 'image/jpeg');
        photoUrls.push(presign.key);
      }
      return api.post(`/service-requests/${id}/dispute-response`, {
        response,
        photoUrls,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['task', id] });
      Alert.alert('Submitted', 'Your response has been escalated to the admin.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const handleSubmit = async () => {
    if (!response.trim()) {
      Alert.alert('Response required', 'Please describe your response to the dispute.');
      return;
    }
    setUploading(true);
    try {
      await submit.mutateAsync();
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !task) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Dispute Response' }} />
        <ActivityIndicator color={colors.primary[500]} />
      </SafeAreaView>
    );
  }

  const dispute = task.dispute;
  const busy = uploading || submit.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Dispute Response" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        {/* Resident dispute reason */}
        <View className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-5">
          <Text className="text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Resident's Dispute
          </Text>
          <Text className="text-red-800 dark:text-red-100 text-sm leading-5">
            {dispute?.reason ?? task.disputeReason ?? 'No reason provided.'}
          </Text>
          {dispute?.createdAt && (
            <Text className="text-red-500 dark:text-red-400 text-xs mt-2">
              Raised {new Date(dispute.createdAt).toLocaleString('en-IN')}
            </Text>
          )}
        </View>

        {/* Task summary */}
        <Card padding="lg">
          <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{task.category}</Text>
          <Text className="text-gray-900 dark:text-gray-100 text-base font-semibold">
            Flat {task.unit?.flatNumber ?? '—'}
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-sm mt-2">{task.description}</Text>
        </Card>

        {/* Your response */}
        <Card padding="lg">
          <Text className="text-gray-900 dark:text-gray-100 font-semibold mb-3">Your Response</Text>
          <TextInput
            value={response}
            onChangeText={setResponse}
            placeholder="Explain what was done and address the dispute…"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-gray-900 dark:text-gray-100 text-sm"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            multiline
          />
        </Card>

        {/* Additional photos */}
        <Card padding="lg">
          <Text className="text-gray-900 dark:text-gray-100 font-semibold mb-1">Additional Photos</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4">Optional — add evidence photos</Text>

          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {photos.map((uri, i) => (
                <View key={i} className="mr-2 relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 100, height: 75, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                  >
                    <Text className="text-white text-xs font-bold">×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={pickPhoto}
            disabled={busy}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-5 items-center"
          >
            <Text className="text-gray-500 dark:text-gray-400 text-sm font-semibold">+ Add Photo</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      <View className="px-5 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={busy || !response.trim()}
          className={`rounded-full items-center py-4 ${!response.trim() ? 'bg-gray-300 dark:bg-gray-700' : 'bg-amber-600'}`}
          style={{ minHeight: 56 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Submit to Admin</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
