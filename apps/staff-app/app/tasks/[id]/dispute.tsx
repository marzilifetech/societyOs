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
import { api } from '../../../src/lib/api';
import { compressImage, uploadToPresigned } from '../../../src/lib/upload';

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
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Dispute Response' }} />
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  const dispute = task.dispute;
  const busy = uploading || submit.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-gray-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Dispute Response</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        {/* Resident dispute reason */}
        <View className="bg-red-950 border border-red-800 rounded-2xl p-5">
          <Text className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Resident's Dispute
          </Text>
          <Text className="text-white text-sm leading-5">
            {dispute?.reason ?? task.disputeReason ?? 'No reason provided.'}
          </Text>
          {dispute?.createdAt && (
            <Text className="text-red-400 text-xs mt-2">
              Raised {new Date(dispute.createdAt).toLocaleString('en-IN')}
            </Text>
          )}
        </View>

        {/* Task summary */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">{task.category}</Text>
          <Text className="text-white text-base font-semibold">
            Flat {task.unit?.flatNumber ?? '—'}
          </Text>
          <Text className="text-gray-300 text-sm mt-2">{task.description}</Text>
        </View>

        {/* Your response */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-3">Your Response</Text>
          <TextInput
            value={response}
            onChangeText={setResponse}
            placeholder="Explain what was done and address the dispute…"
            placeholderTextColor="#6b7280"
            className="bg-gray-800 rounded-xl p-4 text-white text-sm"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            multiline
          />
        </View>

        {/* Additional photos */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-1">Additional Photos</Text>
          <Text className="text-gray-400 text-xs mb-4">Optional — add evidence photos</Text>

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
            className="border-2 border-dashed border-gray-700 rounded-xl py-5 items-center"
          >
            <Text className="text-gray-400 text-sm font-semibold">+ Add Photo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View className="px-5 py-4 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={busy || !response.trim()}
          className={`rounded-2xl items-center py-4 ${!response.trim() ? 'bg-gray-700' : 'bg-amber-600'}`}
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
