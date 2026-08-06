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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { api } from '../../../src/lib/api';
import { compressImage, uploadToPresigned } from '../../../src/lib/upload';
import { AppHeader, Card } from '../../../src/components/ui';

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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Start Work' }} />
        <ActivityIndicator color={colors.primary[500]} />
      </SafeAreaView>
    );
  }

  const busy = uploading || startWork.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Start Work" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
        {/* Task summary */}
        <Card padding="lg">
          <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{task.category}</Text>
          <Text className="text-gray-900 dark:text-gray-100 text-base font-semibold">
            {task.requestedBy?.name ?? 'Resident'} · Flat {task.unit?.flatNumber ?? '—'}
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-sm mt-2">{task.description}</Text>
        </Card>

        {/* Before photo */}
        <Card padding="lg">
          <Text className="text-gray-900 dark:text-gray-100 font-semibold mb-1">Before Photo</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4">Required — capture current state before starting work</Text>

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
                className="bg-gray-100 dark:bg-gray-800 rounded-full py-3 items-center"
              >
                <Text className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickPhoto}
              disabled={busy}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-10 items-center gap-2"
            >
              <Ionicons name="camera-outline" size={36} color={colors.primary[500]} />
              <Text className="text-gray-500 dark:text-gray-400 text-sm font-semibold">Tap to take Before photo</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Resident photos (if any) */}
        {task.photos?.length > 0 && (
          <Card padding="lg">
            <Text className="text-gray-900 dark:text-gray-100 font-semibold mb-3">Resident's Photos</Text>
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
          </Card>
        )}
      </ScrollView>

      <View className="px-5 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          onPress={handleStart}
          disabled={busy || !beforePhoto}
          className={`rounded-full items-center py-4 ${!beforePhoto ? 'bg-gray-300 dark:bg-gray-700' : 'bg-green-600'}`}
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
