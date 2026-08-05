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
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';

type UploadState = {
  // local preview shown while picking / uploading / on retry. Preserved across
  // failed attempts so the user doesn't have to re-pick the image to retry.
  localUri: string;
  // remembered between attempts so retry knows the contentType to upload.
  mime: string;
  // populated only after a successful S3 PUT
  s3Url: string;
  uploading: boolean;
  // human-friendly error message; non-null when the last attempt failed and
  // the user has not yet retried or re-picked.
  error: string | null;
};

const EMPTY: UploadState = { localUri: '', mime: '', s3Url: '', uploading: false, error: null };

// Soft card shadow matching the redesign-kit RoundCard surface.
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
} as const;

async function uploadKycDocument(uri: string, contentType: string): Promise<string> {
  // KYC documents are sensitive → upload as PRIVATE through the Marzi media
  // service. Private assets have no public_url, so we persist the S3 key
  // (admin review fetches the asset via Marzi). `_folder` is retained for the
  // call signature but no longer used (Marzi derives the key path itself).
  const { publicUrl, s3Key } = await uploadViaMedia(uri, {
    contentType,
    visibility: 'private',
  });
  return publicUrl ?? s3Key;
}

/** Map an upload error to a short user-facing string. */
function describeUploadError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Upload failed. Please try again.';
  const e = err as { message?: string; name?: string; status?: number };
  const msg = e.message ?? '';

  // Network failure path — friendlyError on the api side already converts
  // TypeError/"Network request failed" into the "Could not reach" message.
  if (
    e.name === 'TypeError' ||
    msg.includes('Network request failed') ||
    msg.includes('Could not reach the server') ||
    msg.includes('connection')
  ) {
    return "Couldn't reach the server. Check your internet and try again.";
  }
  // S3 upload failures bubble up as `Upload failed (NNN)` from uploadKycDocument.
  const status = e.status ?? (msg.match(/Upload failed \((\d+)\)/)?.[1]);
  if (status) {
    const n = Number(status);
    if (n === 413) return 'That file is too large. Try a smaller image.';
    if (n >= 400 && n < 500) return 'The file was rejected. Try a different image.';
    if (n >= 500) return 'Storage is temporarily unavailable. Try again in a moment.';
  }
  // Backend "service hiccup" message comes through verbatim.
  if (msg.includes('hiccup')) return msg;
  return msg || 'Upload failed. Please try again.';
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
  const upload = async (localUri: string, mime: string) => {
    onChange({ localUri, mime, s3Url: '', uploading: true, error: null });
    try {
      const s3Url = await uploadKycDocument(localUri, mime);
      onChange({ localUri, mime, s3Url, uploading: false, error: null });
    } catch (err) {
      // Preserve localUri + mime so the user can retry without re-picking the
      // image. Previously we wiped both, forcing a re-pick after every error.
      onChange({
        localUri,
        mime,
        s3Url: '',
        uploading: false,
        error: describeUploadError(err),
      });
    }
  };

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
    await upload(localUri, mime);
  };

  const handleRetry = () => {
    if (!state.localUri) return;
    void upload(state.localUri, state.mime || 'image/jpeg');
  };

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100" style={cardShadow}>
      <Text className="text-gray-900 text-base font-semibold mb-1">{label}</Text>
      <Text className="text-gray-400 text-sm mb-4">{subtitle}</Text>

      {state.error && state.localUri ? (
        // Inline error banner — distinct visually from success state. Stays
        // visible until the user retries (handleRetry) or re-picks.
        <View
          accessibilityRole="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 mb-3 flex-row items-start"
        >
          <Ionicons name="warning-outline" size={16} color="#B91C1C" style={{ marginTop: 2 }} />
          <Text className="text-red-700 text-sm flex-1 ml-2">{state.error}</Text>
        </View>
      ) : null}

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
            {state.error ? (
              // Inline retry button — visible whenever the last attempt failed.
              // Pre-existing behaviour Alert'd + wiped localUri, forcing a
              // full re-pick. Now we keep the URI + offer a single-tap retry.
              <TouchableOpacity
                onPress={handleRetry}
                disabled={state.uploading}
                accessibilityRole="button"
                accessibilityLabel={`Retry uploading ${label}`}
                className="bg-primary-500 rounded-xl px-3.5 py-3 min-h-[52px] justify-center flex-row items-center"
              >
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                <Text className="text-white text-sm font-semibold text-center ml-1.5">Retry upload</Text>
              </TouchableOpacity>
            ) : null}
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
            className="flex-1 bg-primary-500 rounded-full h-[52px] items-center justify-center flex-row"
          >
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text className="text-white text-base font-semibold ml-2">Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handlePick('library')}
            className="flex-1 bg-gray-100 rounded-full h-[52px] items-center justify-center border border-gray-200 flex-row"
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
  // Entry guard — the documents endpoint requires a Resident row, created by
  // profile-setup. If the user landed here without completing that step
  // (deep-link, stale notification tap, force-close mid-flow), don't render
  // the form at all — show a single nudge card with a button that takes them
  // to profile-setup. Otherwise they fill out the entire form before learning
  // they need to go back.
  const profile = useQuery({
    queryKey: ['resident-profile-doc-guard'],
    queryFn: () => api.get<any>('/residents/me'),
    retry: false,
    staleTime: 60_000,
  });

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
    onError: (err: any) => {
      // The documents endpoint requires a Resident row (created by the
      // profile-setup step). If the user reached this screen without
      // completing profile-setup first — direct deep-link, back-stack quirk,
      // a stale build — the cryptic backend message reads as a system bug
      // rather than a missed step. Route them back with a friendly nudge.
      const msg = String(err?.message ?? '');
      if (
        msg.toLowerCase().includes('resident profile not found') ||
        msg.toLowerCase().includes('resident not found')
      ) {
        Alert.alert(
          'Finish home details first',
          'Please complete your home details before uploading documents.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/profile-setup') }],
        );
        return;
      }
      Alert.alert('Submit failed', msg || 'Please try again.');
    },
  });

  const anyUploading = aadhaar.uploading || pan.uploading || addressProof.uploading;
  const canSubmit =
    !anyUploading &&
    aadhaarValid &&
    panValid &&
    aadhaar.s3Url.length > 0 &&
    pan.s3Url.length > 0 &&
    addressProof.s3Url.length > 0;

  // Loading the profile-check — show a quiet spinner instead of the form.
  // Once the check resolves: if no profile, show the nudge card. The submit
  // mutation's onError is still in place as a final safety net.
  if (profile.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#821A52" />
      </SafeAreaView>
    );
  }
  if (profile.isError) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-6 justify-center" style={{ gap: 16 }}>
          <Text className="text-2xl font-bold text-gray-900">Finish home details first</Text>
          <Text className="text-base text-gray-500 leading-6">
            Before uploading documents we need a few details about your home — the flat number,
            whether you own or rent, and an emergency contact. Takes under a minute.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/profile-setup')}
            className="bg-primary-500 rounded-full h-14 items-center justify-center"
          >
            <Text className="text-white text-base font-bold">Complete Home Details</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(auth)/pending-approval')}>
            <Text className="text-primary-500 text-base text-center mt-2">Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100" style={cardShadow}>
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
        <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100" style={cardShadow}>
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
          className={`rounded-full h-14 items-center justify-center mt-2 mb-4 ${
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
