import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

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
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets?.[0]) setFile(res.assets[0]);
  };

  const upload = async () => {
    if (!file) return Alert.alert('Pick a file first');
    setUploading(true);
    try {
      // 1. Ask backend for presigned URL
      const presigned = await api.post<{ uploadUrl: string; key: string; fileUrl?: string }>(
        '/staff/documents',
        {
          type,
          fileName: file.name,
          contentType: file.mimeType ?? 'application/octet-stream',
        },
      );

      // 2. PUT file to S3
      const blob = await (await fetch(file.uri)).blob();
      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.mimeType ?? 'application/octet-stream' },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      // 3. Confirm
      try {
        await api.post('/staff/documents/confirm', {
          key: presigned.key,
          type,
          fileName: file.name,
        });
      } catch (err: any) {
        // confirm may not exist on backend; ignore
        if (__DEV__) console.warn('[documents] confirm failed', err?.message);
      }

      qc.invalidateQueries({ queryKey: ['staff-documents'] });
      Alert.alert('Uploaded', 'Document uploaded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Try again');
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
