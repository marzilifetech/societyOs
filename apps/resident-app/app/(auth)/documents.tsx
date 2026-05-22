import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

function UploadField({
  label,
  subtitle,
  uri,
  onSelect,
}: {
  label: string;
  subtitle: string;
  uri: string;
  onSelect: (uri: string) => void;
}) {
  const requestAndLaunch = async (launcher: () => Promise<ImagePicker.ImagePickerResult>) => {
    const result = await launcher();
    if (!result.canceled && result.assets[0]) {
      onSelect(result.assets[0].uri);
    }
  };

  const handlePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    await requestAndLaunch(() =>
      ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }),
    );
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required.');
      return;
    }
    await requestAndLaunch(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }),
    );
  };

  return (
    <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
      <Text className="text-gray-900 text-base font-semibold mb-1">{label}</Text>
      <Text className="text-gray-400 text-sm mb-4">{subtitle}</Text>

      {uri ? (
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <Image
            source={{ uri }}
            style={{ width: 100, height: 100, borderRadius: 12 }}
            resizeMode="cover"
          />
          <View className="flex-1" style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={handlePhoto}
              className="bg-primary-50 rounded-xl px-3.5 py-3 border border-primary-500 min-h-[52px] justify-center flex-row items-center"
            >
              <Ionicons name="camera-outline" size={16} color="#821A52" />
              <Text className="text-primary-500 text-sm font-semibold text-center ml-1.5">
                Retake Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleGallery}
              className="bg-gray-100 rounded-xl px-3.5 py-3 border border-gray-200 min-h-[52px] justify-center"
            >
              <Text className="text-gray-700 text-sm font-semibold text-center">From Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={handlePhoto}
            className="flex-1 bg-primary-500 rounded-2xl h-[52px] items-center justify-center flex-row"
          >
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text className="text-white text-base font-semibold ml-2">Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleGallery}
            className="flex-1 bg-gray-100 rounded-2xl h-[52px] items-center justify-center border border-gray-200 flex-row"
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#374151" />
            <Text className="text-gray-700 text-base font-semibold ml-2">From Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function DocumentsScreen() {
  const [idProof, setIdProof] = useState('');
  const [addressProof, setAddressProof] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/residents/documents', { idProof, addressProof }),
    onSuccess: () => router.replace('/(auth)/pending-approval'),
    onError: (err: any) => Alert.alert('Upload Failed', err.message ?? 'Please try again.'),
  });

  const canSubmit = idProof.length > 0 && addressProof.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <View className="pt-4 mb-2">
          <TouchableOpacity onPress={() => router.back()} className="py-2 flex-row items-center">
            <Ionicons name="chevron-back" size={20} color="#821A52" />
            <Text className="text-primary-500 text-base ml-1">Back</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-3xl font-bold text-gray-900 mb-2">Upload Documents</Text>
        <Text className="text-base text-gray-500 mb-8 leading-6">
          Upload your ID and address proof for faster verification by the society office.
        </Text>

        <UploadField
          label="ID Proof"
          subtitle="Aadhaar card, passport, or driving licence"
          uri={idProof}
          onSelect={setIdProof}
        />

        <UploadField
          label="Address Proof"
          subtitle="Utility bill, bank statement, or property document"
          uri={addressProof}
          onSelect={setAddressProof}
        />

        <TouchableOpacity
          onPress={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className={`rounded-2xl h-14 items-center justify-center mt-2 mb-4 ${
            canSubmit ? 'bg-primary-500' : 'bg-primary-200'
          }`}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-bold">Submit Documents</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/pending-approval')}
          className="items-center py-3.5"
        >
          <Text className="text-gray-400 text-base">Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
