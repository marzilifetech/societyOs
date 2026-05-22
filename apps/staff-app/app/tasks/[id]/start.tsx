import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { api } from '../../../src/lib/api';
import { compressImage, uploadToPresigned } from '../../../src/lib/upload';

export default function StartWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
    enabled: !!id,
  });

  const startWork = useMutation({
    mutationFn: async (photoUrl: string) => {
      await api.post(`/service-requests/${id}/proof`, {
        phase: 'BEFORE',
        photoUrl,
      });
      return api.patch(`/service-requests/${id}/status`, { status: 'IN_PROGRESS' });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      Alert.alert('Work Started', 'Before photo saved. Work is now in progress.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, { maxWidth: 1200 });
      setBeforePhoto(compressed);
    }
  };

  const handleStart = async () => {
    if (!beforePhoto) {
      Alert.alert('Photo Required', 'Please take a before photo before starting work.');
      return;
    }
    setUploading(true);
    try {
      const presign = await api.get<{ url: string; key: string }>(
        `/service-requests/${id}/photo-upload-url?phase=BEFORE`,
      );
      await uploadToPresigned(presign.url, beforePhoto, 'image/jpeg');
      await startWork.mutateAsync(presign.key);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !task) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Start Work' }} />
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  const busy = uploading || startWork.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-gray-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Start Work</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
        {/* Task summary */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">{task.category}</Text>
          <Text className="text-white text-base font-semibold">
            {task.requestedBy?.name ?? 'Resident'} · Flat {task.unit?.flatNumber ?? '—'}
          </Text>
          <Text className="text-gray-300 text-sm mt-2">{task.description}</Text>
        </View>

        {/* Before photo */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-1">Before Photo</Text>
          <Text className="text-gray-400 text-xs mb-4">Required — capture current state before starting work</Text>

          {beforePhoto ? (
            <View className="gap-3">
              <Image
                source={{ uri: beforePhoto }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={pickPhoto}
                disabled={busy}
                className="bg-gray-800 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-300 text-sm font-semibold">Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickPhoto}
              disabled={busy}
              className="border-2 border-dashed border-gray-700 rounded-xl py-10 items-center gap-2"
            >
              <Text className="text-4xl">📷</Text>
              <Text className="text-gray-400 text-sm font-semibold">Tap to take Before photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resident photos (if any) */}
        {task.photos?.length > 0 && (
          <View className="bg-gray-900 rounded-2xl p-5">
            <Text className="text-white font-semibold mb-3">Resident's Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {task.photos.map((p: any, i: number) => (
                <Image
                  key={i}
                  source={{ uri: p.url }}
                  style={{ width: 120, height: 90, borderRadius: 8, marginRight: 8 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View className="px-5 py-4 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleStart}
          disabled={busy || !beforePhoto}
          className={`rounded-2xl items-center py-4 ${!beforePhoto ? 'bg-gray-700' : 'bg-green-600'}`}
          style={{ minHeight: 56 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Start Work</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
