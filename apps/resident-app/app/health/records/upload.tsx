import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../src/lib/api';
import { uploadViaMedia } from '../../../src/lib/photo-upload';
import { DateField } from '../../../src/components/common/DateField';

type IoniconName = keyof typeof Ionicons.glyphMap;

const DOC_TYPES = ['Prescription', 'Lab Report', 'Scan / X-Ray', 'Vaccination', 'Insurance', 'Other'];

const PICK_BUTTONS: { label: string; src: 'camera' | 'gallery'; icon: IoniconName }[] = [
  { label: 'Camera', src: 'camera', icon: 'camera-outline' },
  { label: 'Gallery', src: 'gallery', icon: 'images-outline' },
];

export default function UploadRecordScreen() {
  const qc = useQueryClient();
  const [docType, setDocType] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docName, setDocName] = useState('');
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post('/health/records', { type: docType, date: docDate, name: docName, fileKey: uploadedKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-records'] });
      Alert.alert('Uploaded', 'Health record uploaded successfully.');
      router.back();
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not upload. Please try again.'),
  });

  const handlePickFile = async (source: 'camera' | 'gallery') => {
    let uri: string | null = null;
    let mime: string | undefined;
    let name: string | undefined;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access.');
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!r.canceled) {
        uri = r.assets[0]?.uri ?? null;
        mime = r.assets[0]?.mimeType;
        name = r.assets[0]?.fileName ?? undefined;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!r.canceled) {
        uri = r.assets[0]?.uri ?? null;
        mime = r.assets[0]?.mimeType;
        name = r.assets[0]?.fileName ?? undefined;
      }
    }
    if (!uri) return;
    setLocalUri(uri);
    setUploading(true);
    try {
      const { s3Key } = await uploadViaMedia(uri, {
        contentType: mime,
        filename: name,
        visibility: 'private',
      });
      setUploadedKey(s3Key);
    } catch (e: any) {
      setLocalUri(null);
      setUploadedKey(null);
      Alert.alert('Upload failed', e?.message ?? 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Upload Record</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Document Type */}
        <Text className="text-gray-500 text-sm font-semibold mb-3 uppercase tracking-wide">Document Type</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {DOC_TYPES.map((t) => {
            const isActive = docType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setDocType(t)}
                className="rounded-2xl px-4 py-3"
                style={{
                  minHeight: 48,
                  backgroundColor: isActive ? '#821A52' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isActive ? '#821A52' : '#E5E7EB',
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: isActive ? '#fff' : '#6B7280' }}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <View className="mb-5">
          <DateField label="Document Date" value={docDate} onChange={setDocDate} mode="date" />
        </View>

        {/* Name */}
        <Text className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wide">Document Name</Text>
        <TextInput
          value={docName}
          onChangeText={setDocName}
          placeholder="e.g. CBC Report Jan 2026"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 text-lg mb-6"
          style={{ minHeight: 56 }}
        />

        {/* File Picker */}
        <Text className="text-gray-500 text-sm font-semibold mb-3 uppercase tracking-wide">Choose File</Text>
        <View className="flex-row gap-3 mb-4">
          {PICK_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.src}
              onPress={() => handlePickFile(btn.src)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl py-4 items-center"
              style={{ minHeight: 80 }}
            >
              <Ionicons name={btn.icon} size={24} color="#821A52" />
              <Text className="text-gray-700 text-sm font-semibold mt-1">{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(localUri || uploading) && (
          <View className="bg-primary-50 border border-primary-500/30 rounded-2xl px-4 py-3 mb-4 flex-row items-center gap-2">
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'checkmark-circle'} size={18} color="#821A52" />
            <Text className="text-primary-500 text-sm flex-1" numberOfLines={1}>
              {uploading ? 'Uploading file…' : `File ready (${uploadedKey?.slice(-12) ?? 'attached'})`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => {
            if (!docType) { Alert.alert('Required', 'Select document type.'); return; }
            if (!docName.trim()) { Alert.alert('Required', 'Enter document name.'); return; }
            if (!uploadedKey) { Alert.alert('Required', 'Please choose a file.'); return; }
            mutate();
          }}
          disabled={isPending || uploading}
          className="bg-primary-500 rounded-xl py-4 mt-4 items-center"
          style={{ minHeight: 56, opacity: (isPending || uploading) ? 0.6 : 1 }}
        >
          <Text className="text-white text-lg font-bold">{isPending ? 'Saving…' : 'Upload Record'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
