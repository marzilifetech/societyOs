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

export default function LaundryPickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [garmentCount, setGarmentCount] = useState('');
  const [instructionsConfirmed, setInstructionsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ['laundry', id],
    queryFn: () => api.get<any>(`/laundry/${id}`),
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

  const handlePickup = async () => {
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a photo of the received items.');
      return;
    }
    if (!garmentCount || isNaN(Number(garmentCount))) {
      Alert.alert('Count Required', 'Please confirm the garment count.');
      return;
    }
    if (request?.specialInstructions && !instructionsConfirmed) {
      Alert.alert('Confirm Instructions', 'Please confirm you have read the special instructions.');
      return;
    }
    setUploading(true);
    try {
      const uploadedKey = await uploadMediaAndGetKey(photo, {
        contentType: 'image/jpeg',
        filename: `upload-${Date.now()}.jpg`,
      });
      await api.patch(`/laundry/${id}/pickup`, {
        photoUrl: uploadedKey,
        garmentCount: Number(garmentCount),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ['laundry'] });
      Alert.alert('Picked Up', 'Laundry marked as picked up.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !request) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Pickup' }} />
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  const canSubmit = !!photo && !!garmentCount && (!request.specialInstructions || instructionsConfirmed);

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-gray-900 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Laundry Pickup</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        {/* Resident info */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-xs text-gray-400 uppercase tracking-wider mb-2">Resident</Text>
          <Text className="text-white text-base font-semibold">
            {request.resident?.name ?? 'Resident'} · Flat {request.resident?.flat ?? '—'}
          </Text>
          {request.itemsDescription && (
            <Text className="text-gray-300 text-sm mt-2">{request.itemsDescription}</Text>
          )}
          <View className="flex-row items-center mt-3 gap-4">
            <View>
              <Text className="text-gray-500 text-xs">Expected count</Text>
              <Text className="text-white font-bold">{request.garmentCount ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Special instructions */}
        {request.specialInstructions && (
          <View className="bg-amber-950 border border-amber-700 rounded-2xl p-5">
            <Text className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Special Instructions
            </Text>
            <Text className="text-white text-sm leading-5">{request.specialInstructions}</Text>
            <TouchableOpacity
              onPress={() => setInstructionsConfirmed((v) => !v)}
              className="flex-row items-center gap-3 mt-4"
            >
              <View className={`w-6 h-6 rounded border-2 items-center justify-center ${instructionsConfirmed ? 'bg-green-500 border-green-500' : 'border-gray-500'}`}>
                {instructionsConfirmed && <Text className="text-white text-xs font-bold">✓</Text>}
              </View>
              <Text className="text-gray-300 text-sm">I have read and understood the instructions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Garment count */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-3">Garment Count Confirmation</Text>
          <TextInput
            value={garmentCount}
            onChangeText={setGarmentCount}
            placeholder={`Expected: ${request.garmentCount ?? '?'}`}
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            className="bg-gray-800 rounded-xl p-4 text-white text-base font-bold"
            style={{ fontSize: 24, textAlign: 'center' }}
          />
          <Text className="text-gray-500 text-xs mt-2 text-center">Enter actual garment count</Text>
        </View>

        {/* Photo */}
        <View className="bg-gray-900 rounded-2xl p-5">
          <Text className="text-white font-semibold mb-1">Photo of Items</Text>
          <Text className="text-gray-400 text-xs mb-4">Required — photograph all received items</Text>

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
      </ScrollView>

      <View className="px-5 py-4 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity
          onPress={handlePickup}
          disabled={uploading || !canSubmit}
          className={`rounded-2xl items-center py-4 ${!canSubmit ? 'bg-gray-700' : 'bg-blue-600'}`}
          style={{ minHeight: 56 }}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Mark Picked Up</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
