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
import { compressImage } from '../../../src/lib/upload';
import { uploadMediaAndGetKey } from '../../../src/lib/photo-upload';

export default function HousekeepingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['housekeeping', id],
    queryFn: () => api.get<any>(`/housekeeping/${id}`),
    enabled: !!id,
  });

  const pickPhoto = async (phase: 'before' | 'after') => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, { maxWidth: 1200 });
      if (phase === 'before') setBeforePhoto(compressed);
      else setAfterPhoto(compressed);
    }
  };

  const handleComplete = async () => {
    if (!beforePhoto) {
      Alert.alert('Before Photo Required', 'Please take a before photo.');
      return;
    }
    if (!afterPhoto) {
      Alert.alert('After Photo Required', 'Please take an after photo.');
      return;
    }
    setUploading(true);
    try {
      const uploadPhoto = async (uri: string, phase: string) => {
        const uploadedKey = await uploadMediaAndGetKey(uri, {
          contentType: 'image/jpeg',
          filename: `upload-${Date.now()}.jpg`,
        });
        return uploadedKey;
      };
      const [beforeKey, afterKey] = await Promise.all([
        uploadPhoto(beforePhoto, 'BEFORE'),
        uploadPhoto(afterPhoto, 'AFTER'),
      ]);
      await api.patch(`/housekeeping/${id}/status`, {
        status: 'COMPLETED',
        beforePhotoUrl: beforeKey,
        afterPhotoUrl: afterKey,
        notes,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
      Alert.alert('Done', 'Housekeeping task completed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !task) {
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
        <Text className="text-white text-lg font-bold ml-2">Complete Housekeeping</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">Area</Text>
          <Text className="text-white text-base font-semibold">{task.area ?? task.title ?? '—'}</Text>
          {task.notes && <Text className="text-gray-300 text-sm mt-2">{task.notes}</Text>}
        </View>

        {/* Photo pair */}
        {(['before', 'after'] as const).map((phase) => {
          const uri = phase === 'before' ? beforePhoto : afterPhoto;
          return (
            <View key={phase} className="bg-gray-900 rounded-2xl p-5">
              <Text className="text-white font-semibold mb-1 capitalize">{phase} Photo</Text>
              <Text className="text-gray-400 text-xs mb-4">Required</Text>
              {uri ? (
                <View className="gap-3">
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => pickPhoto(phase)}
                    disabled={uploading}
                    className="bg-gray-800 rounded-xl py-3 items-center"
                  >
                    <Text className="text-gray-300 text-sm font-semibold">Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => pickPhoto(phase)}
                  disabled={uploading}
                  className="border-2 border-dashed border-gray-700 rounded-xl py-8 items-center gap-2"
                >
                  <Text className="text-3xl">📷</Text>
                  <Text className="text-gray-400 text-sm font-semibold capitalize">Take {phase} photo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-3">Area Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any observations about the area…"
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
          disabled={uploading || !beforePhoto || !afterPhoto}
          className={`rounded-2xl items-center py-4 ${!beforePhoto || !afterPhoto ? 'bg-gray-700' : 'bg-green-600'}`}
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
