import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Switch, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { pickImageFromLibrary, uploadToPresignedUrl } from '../../src/lib/photo-upload';

const ROLES = ['Cook', 'Maid', 'Driver', 'Gardener', 'Security', 'Other'];

export default function AddDomesticHelpScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [gateAccess, setGateAccess] = useState(false);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickPhoto = async () => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setLocalPhotoUri(uri);
    setUploading(true);
    try {
      const presign = await api.post<{ url: string; key: string }>('/upload/presign', {
        contentType: 'image/jpeg',
        folder: 'domestic-help',
      });
      await uploadToPresignedUrl(uri, presign.url, 'image/jpeg');
      setPhotoKey(presign.key);
    } catch (e: any) {
      setLocalPhotoUri(null);
      setPhotoKey(null);
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post('/domestic-help', { name, role, phone, gateAccess, photoKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domestic-help'] });
      Alert.alert('Registered', `${name} has been registered.`);
      router.back();
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not register. Please try again.'),
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Register Helper</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Photo picker */}
        <TouchableOpacity
          onPress={handlePickPhoto}
          disabled={uploading}
          className="self-center w-24 h-24 rounded-full bg-gray-50 border border-gray-200 items-center justify-center mb-6 overflow-hidden"
          accessibilityRole="button"
          accessibilityLabel="Add photo of helper"
        >
          {localPhotoUri ? (
            <Image source={{ uri: localPhotoUri }} style={{ width: 96, height: 96 }} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
              <Text className="text-gray-500 text-xs mt-1">{uploading ? 'Uploading…' : 'Add Photo'}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wide">Full Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ramu Kaka"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 text-lg mb-5"
          style={{ minHeight: 56 }}
        />

        <Text className="text-gray-500 text-sm font-semibold mb-3 uppercase tracking-wide">Role</Text>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {ROLES.map((r) => {
            const isActive = role === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                className="rounded-2xl px-4 py-3"
                style={{
                  minHeight: 48,
                  backgroundColor: isActive ? '#821A52' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isActive ? '#821A52' : '#E5E7EB',
                }}
              >
                <Text className="font-semibold text-sm" style={{ color: isActive ? '#fff' : '#6B7280' }}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wide">Phone Number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 text-lg mb-5"
          style={{ minHeight: 56 }}
        />

        <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-8" style={{ minHeight: 64 }}>
          <View>
            <Text className="text-gray-900 text-base font-semibold">Gate Access</Text>
            <Text className="text-gray-500 text-sm mt-0.5">Allow entry via gate QR scan</Text>
          </View>
          <Switch
            value={gateAccess}
            onValueChange={setGateAccess}
            trackColor={{ false: '#E5E7EB', true: '#821A52' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            if (!name.trim()) { Alert.alert('Required', 'Enter name.'); return; }
            if (!role) { Alert.alert('Required', 'Select role.'); return; }
            mutate();
          }}
          disabled={isPending}
          className="bg-primary-500 rounded-xl py-4 items-center"
          style={{ minHeight: 56, opacity: isPending ? 0.6 : 1 }}
        >
          <Text className="text-white text-lg font-bold">{isPending ? 'Registering...' : 'Register Helper'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
