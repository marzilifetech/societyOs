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

export default function HelpRequestCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['help-request', id],
    queryFn: () => api.get<any>(`/staff/help-requests/${id}`),
    enabled: !!id,
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, { maxWidth: 1200 });
      setPhoto(compressed);
    }
  };

  const handleComplete = async () => {
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a completion photo.');
      return;
    }
    setUploading(true);
    try {
      const presign = await api.get<{ url: string; key: string }>(
        `/help-requests/${id}/photo-upload-url`,
      );
      await uploadToPresigned(presign.url, photo, 'image/jpeg');
      await api.post(`/staff/help-requests/${id}/complete`, {
        photoUrl: presign.key,
        notes,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['help-requests'] });
      qc.invalidateQueries({ queryKey: ['help-request', id] });
      Alert.alert('Done', 'Help request marked as complete.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Complete' }} />
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-gray-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Complete Help Request</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-2">Request</Text>
          <Text className="text-white text-base font-semibold">
            {data.resident?.name ?? 'Resident'} · Flat {data.resident?.flat ?? '—'}
          </Text>
          <Text className="text-gray-300 text-sm mt-2">{data.description ?? '—'}</Text>
        </View>

        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-1">Completion Photo</Text>
          <Text className="text-gray-400 text-xs mb-4">Required — prove the task is done</Text>

          {photo ? (
            <View className="gap-3">
              <Image
                source={{ uri: photo }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={pickPhoto}
                disabled={uploading}
                className="bg-gray-800 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-300 text-sm font-semibold">Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickPhoto}
              disabled={uploading}
              className="border-2 border-dashed border-gray-700 rounded-xl py-10 items-center gap-2"
            >
              <Text className="text-4xl">📷</Text>
              <Text className="text-gray-400 text-sm font-semibold">Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-3">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="What was done…"
            placeholderTextColor="#6b7280"
            className="bg-gray-800 rounded-xl p-4 text-white text-sm"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            multiline
          />
        </View>
      </ScrollView>

      <View className="px-5 py-4 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleComplete}
          disabled={uploading || !photo}
          className={`rounded-2xl items-center py-4 ${!photo ? 'bg-gray-700' : 'bg-green-600'}`}
          style={{ minHeight: 56 }}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Mark Complete</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
