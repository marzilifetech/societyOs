import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';
import { compressImageUnder, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from '../../src/lib/upload';

const TYPES = [
  { key: 'AADHAAR', label: 'Aadhaar' },
  { key: 'PAN', label: 'PAN' },
  { key: 'CONTRACT', label: 'Contract' },
  { key: 'CERTIFICATION', label: 'Certification' },
  { key: 'OTHER', label: 'Other' },
];

export default function DocumentUploadScreen() {
  const [type, setType] = useState<string>('AADHAAR');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) setFile(res.assets[0]);
    } catch (e: unknown) {
      Alert.alert("Couldn't open files", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  /**
   * Upload through /media as a PRIVATE asset (these are ID documents), then
   * record it. This used to PUT to a backend-presigned S3 URL, which always
   * returned 403, and then said "Uploaded" even when recording it failed.
   */
  const upload = async () => {
    if (!file) return Alert.alert('Pick a file first');
    const isPdf = (file.mimeType ?? '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    // The media service refuses PDFs over 5 MB (it used to be checked against
    // 10 MB here, so 5–10 MB files failed only after uploading).
    if (isPdf && file.size && file.size > MAX_DOCUMENT_BYTES) {
      return Alert.alert('File too large', 'Choose a PDF under 5 MB, or take a photo instead.');
    }
    setUploading(true);
    try {
      let uri = file.uri;
      if (!isPdf) {
        // Phone cameras often save HEIC, which the media service rejects; send
        // JPEG — and under its 1 MB image limit, shrinking until it fits.
        const compressed = await compressImageUnder(file.uri, MAX_IMAGE_BYTES);
        if (compressed.size !== null && compressed.size > MAX_IMAGE_BYTES) {
          Alert.alert('Photo too large', 'Could not make this photo small enough. Try a closer, simpler shot.');
          return;
        }
        uri = compressed.uri;
      }
      const uploaded = await uploadViaMedia(uri, {
        visibility: 'private',
        contentType: isPdf ? 'application/pdf' : 'image/jpeg',
        filename: `${type.toLowerCase()}-${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`,
      });
      await api.post('/staff/documents/confirm', { key: uploaded.s3Key, type });
      qc.invalidateQueries({ queryKey: ['staff-documents'] });
      Alert.alert('Uploaded', 'Your document has been saved securely.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Upload Document</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-5">
        <View>
          <Text className="text-sm font-semibold text-gray-700 mb-2">Document type</Text>
          <View className="flex-row flex-wrap gap-2">
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                className={`px-4 py-2 rounded-full border ${type === t.key ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={type === t.key ? 'text-white text-sm font-semibold' : 'text-gray-700 text-sm'}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={pickFile} className="bg-white rounded-2xl p-6 items-center border-2 border-dashed border-gray-300">
          <Text className="text-3xl mb-2">{file ? '📄' : '📁'}</Text>
          <Text className="text-gray-700 font-semibold">{file ? file.name : 'Tap to choose file'}</Text>
          <Text className="text-gray-400 text-xs mt-1">PDF or image</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={upload}
          disabled={!file || uploading}
          className={`rounded-2xl py-4 items-center ${file && !uploading ? 'bg-primary-500' : 'bg-gray-300'}`}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-bold text-base">Upload</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
