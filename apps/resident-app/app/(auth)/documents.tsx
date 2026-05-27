import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

type UploadState = {
  // local preview while picking / uploading
  localUri: string;
  // populated only after a successful S3 PUT
  s3Url: string;
  uploading: boolean;
};

const EMPTY: UploadState = { localUri: '', s3Url: '', uploading: false };

async function presignAndUpload(uri: string, folder: string, contentType: string): Promise<string> {
  // 1. Ask backend for a presigned PUT URL
  const presigned = await api.post<{ url: string; key: string; publicUrl: string }>(
    '/upload/presign',
    { folder, contentType },
  );

  // 2. PUT the file to S3
  const blob = await (await fetch(uri)).blob();
  const putRes = await fetch(presigned.url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return presigned.publicUrl;
}

function UploadField({
  label,
  subtitle,
  state,
  onChange,
  folder,
}: {
  label: string;
  subtitle: string;
  state: UploadState;
  onChange: (next: UploadState) => void;
  folder: string;
}) {
  const handlePick = async (mode: 'camera' | 'library') => {
    const perm =
      mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', `${mode === 'camera' ? 'Camera' : 'Gallery'} permission is required.`);
      return;
    }
    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const localUri = result.assets[0].uri;
    const mime = result.assets[0].mimeType ?? 'image/jpeg';
    onChange({ localUri, s3Url: '', uploading: true });
    try {
      const s3Url = await presignAndUpload(localUri, folder, mime);
      onChange({ localUri, s3Url, uploading: false });
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload to storage. Please try again.');
      onChange({ localUri: '', s3Url: '', uploading: false });
    }
  };

  return (
    <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
      <Text className="text-gray-900 text-base font-semibold mb-1">{label}</Text>
      <Text className="text-gray-400 text-sm mb-4">{subtitle}</Text>

      {state.localUri ? (
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <View>
            <Image
              source={{ uri: state.localUri }}
              style={{ width: 100, height: 100, borderRadius: 12 }}
              resizeMode="cover"
            />
            {state.uploading && (
              <View
                className="absolute inset-0 items-center justify-center bg-black/40 rounded-xl"
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
            {state.s3Url ? (
              <View className="absolute bottom-1 right-1 bg-green-600 rounded-full w-5 h-5 items-center justify-center">
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View className="flex-1" style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => handlePick('camera')}
              disabled={state.uploading}
              className="bg-primary-50 rounded-xl px-3.5 py-3 border border-primary-500 min-h-[52px] justify-center flex-row items-center"
            >
              <Ionicons name="camera-outline" size={16} color="#821A52" />
              <Text className="text-primary-500 text-sm font-semibold text-center ml-1.5">Retake Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePick('library')}
              disabled={state.uploading}
              className="bg-gray-100 rounded-xl px-3.5 py-3 border border-gray-200 min-h-[52px] justify-center"
            >
              <Text className="text-gray-700 text-sm font-semibold text-center">From Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => handlePick('camera')}
            className="flex-1 bg-primary-500 rounded-2xl h-[52px] items-center justify-center flex-row"
          >
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text className="text-white text-base font-semibold ml-2">Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handlePick('library')}
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

function maskAadhaar(digits: string): string {
  // Keep last 4 visible, mask first 8 as X — formatted as XXXX-XXXX-1234
  if (digits.length <= 4) return digits;
  const hidden = digits.slice(0, -4).replace(/\d/g, 'X');
  const visible = digits.slice(-4);
  const all = (hidden + visible).match(/.{1,4}/g) ?? [];
  return all.join('-');
}

export default function DocumentsScreen() {
  const [aadhaar, setAadhaar] = useState<UploadState>(EMPTY);
  const [pan, setPan] = useState<UploadState>(EMPTY);
  const [addressProof, setAddressProof] = useState<UploadState>(EMPTY);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFocused, setAadhaarFocused] = useState(false);
  const [panNumber, setPanNumber] = useState('');

  const aadhaarValid = /^\d{12}$/.test(aadhaarNumber);
  const panValid = /^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/residents/documents', {
        aadhaarUrl: aadhaar.s3Url || undefined,
        aadhaarNumber: aadhaarNumber || undefined,
        panUrl: pan.s3Url || undefined,
        panNumber: panNumber || undefined,
        addressProofUrl: addressProof.s3Url || undefined,
      }),
    onSuccess: () => router.replace('/(auth)/pending-approval'),
    onError: (err: any) => Alert.alert('Submit failed', err.message ?? 'Please try again.'),
  });

  const anyUploading = aadhaar.uploading || pan.uploading || addressProof.uploading;
  const canSubmit =
    !anyUploading &&
    aadhaarValid &&
    panValid &&
    aadhaar.s3Url.length > 0 &&
    pan.s3Url.length > 0 &&
    addressProof.s3Url.length > 0;

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
          Provide your Aadhaar and PAN details for faster KYC verification by the society office.
        </Text>

        {/* Aadhaar number */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-base font-semibold mb-1">Aadhaar number</Text>
          <Text className="text-gray-400 text-sm mb-4">12 digits, no spaces</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            value={aadhaarFocused ? aadhaarNumber : aadhaarNumber.length === 12 ? maskAadhaar(aadhaarNumber) : aadhaarNumber}
            onChangeText={(t) => setAadhaarNumber(t.replace(/\D/g, '').slice(0, 12))}
            onFocus={() => setAadhaarFocused(true)}
            onBlur={() => setAadhaarFocused(false)}
            keyboardType="number-pad"
            maxLength={aadhaarFocused ? 12 : 14}
            placeholder="123412341234"
            placeholderTextColor="#9CA3AF"
          />
          {aadhaarNumber.length > 0 && !aadhaarValid && (
            <Text className="text-red-500 text-xs mt-2">Aadhaar must be exactly 12 digits.</Text>
          )}
        </View>

        {/* PAN number */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-base font-semibold mb-1">PAN number</Text>
          <Text className="text-gray-400 text-sm mb-4">10 characters, e.g. ABCDE1234F</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            value={panNumber}
            onChangeText={(t) => setPanNumber(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            placeholder="ABCDE1234F"
            placeholderTextColor="#9CA3AF"
          />
          {panNumber.length > 0 && !panValid && (
            <Text className="text-red-500 text-xs mt-2">PAN must be in format ABCDE1234F.</Text>
          )}
        </View>

        <UploadField
          label="Aadhaar photo"
          subtitle="Front side, clearly visible"
          state={aadhaar}
          onChange={setAadhaar}
          folder="resident-docs/aadhaar"
        />

        <UploadField
          label="PAN photo"
          subtitle="Clear photo of your PAN card"
          state={pan}
          onChange={setPan}
          folder="resident-docs/pan"
        />

        <UploadField
          label="Address proof"
          subtitle="Utility bill, bank statement, or property document"
          state={addressProof}
          onChange={setAddressProof}
          folder="resident-docs/address"
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
