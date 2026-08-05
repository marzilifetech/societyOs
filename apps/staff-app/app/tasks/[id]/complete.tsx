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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import { api } from '../../../src/lib/api';
import { compressImage, uploadToPresigned } from '../../../src/lib/upload';
import { AppHeader } from '../../../src/components/ui';

export default function CompleteWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<any>(`/service-requests/${id}`),
    enabled: !!id,
  });

  const pickPhoto = async () => {
    if (afterPhotos.length >= 5) {
      Alert.alert('Limit reached', 'You can add up to 5 after photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, { maxWidth: 1200 });
      setAfterPhotos((p) => [...p, compressed]);
    }
  };

  const handleComplete = async () => {
    if (afterPhotos.length === 0) {
      Alert.alert('Photo Required', 'Please take at least one after photo.');
      return;
    }
    setUploading(true);
    try {
      const photoUrls: string[] = [];
      for (const uri of afterPhotos) {
        const presign = await api.get<{ url: string; key: string }>(
          `/service-requests/${id}/photo-upload-url?phase=AFTER`,
        );
        await uploadToPresigned(presign.url, uri, 'image/jpeg');
        photoUrls.push(presign.key);
      }
      await api.patch(`/service-requests/${id}/complete`, { photoUrls, notes });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/60 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={48} color="#15803D" />
        </View>
        <Text className="text-gray-900 dark:text-gray-100 text-2xl font-heading mb-2 text-center">Work Completed</Text>
        <Text className="text-gray-500 dark:text-gray-400 text-sm text-center mb-8">
          Awaiting resident confirmation. You'll be notified once they confirm.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary-500 dark:bg-primary-600 rounded-full px-8 py-4 w-full items-center"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white font-bold text-base">Back to Tasks</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading || !task) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Complete Work' }} />
        <ActivityIndicator color={colors.primary[500]} />
      </SafeAreaView>
    );
  }

  const busy = uploading;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Complete Work" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        {/* Task summary */}
        <View className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
          <View className="flex-row items-center mb-1">
            <Ionicons name="clipboard" size={12} color="#6B7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{task.category}</Text>
          </View>
          <Text className="text-gray-900 dark:text-gray-100 text-base font-semibold">
            {task.requestedBy?.name ?? 'Resident'} · Flat {task.unit?.flatNumber ?? '—'}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mt-2">{task.description}</Text>
        </View>

        {/* After photos */}
        <View className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-gray-900 dark:text-gray-100 font-semibold">After Photos</Text>
            <Text className="text-gray-400 dark:text-gray-500 text-xs">{afterPhotos.length}/5</Text>
          </View>
          <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4">Required — show completed work</Text>

          {afterPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {afterPhotos.map((uri, i) => (
                <View key={i} className="mr-2 relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 120, height: 90, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setAfterPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={pickPhoto}
            disabled={busy || afterPhotos.length >= 5}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-6 items-center gap-1"
          >
            <Ionicons name="camera-outline" size={28} color={colors.primary[500]} />
            <Text className="text-gray-500 dark:text-gray-400 text-sm font-semibold">
              {afterPhotos.length === 0 ? 'Take After Photo' : 'Add Another'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
          <Text className="text-gray-900 dark:text-gray-100 font-semibold mb-3">Work Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe what was done…"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-gray-900 dark:text-gray-100 text-sm"
            style={{ minHeight: 100, textAlignVertical: 'top' }}
            multiline
          />
        </View>
      </ScrollView>

      <View className="px-5 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          onPress={handleComplete}
          disabled={busy || afterPhotos.length === 0}
          className={`rounded-full items-center py-4 flex-row justify-center ${afterPhotos.length === 0 ? 'bg-gray-200 dark:bg-gray-700' : 'bg-primary-500 dark:bg-primary-600'}`}
          style={{ minHeight: 56 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={18} color={afterPhotos.length === 0 ? '#9CA3AF' : '#fff'} />
              <Text className={`font-bold text-base ml-2 ${afterPhotos.length === 0 ? 'text-gray-400' : 'text-white'}`}>Mark Complete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
