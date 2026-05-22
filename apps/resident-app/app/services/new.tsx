import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { pickImageFromLibrary, uploadToPresignedUrl } from '../../src/lib/photo-upload';

type IoniconName = keyof typeof Ionicons.glyphMap;

const PREFERRED_TIMES = [
  { label: 'Morning', sub: '9 AM – 12 PM', value: 'Morning (9–12)' },
  { label: 'Afternoon', sub: '2 PM – 5 PM', value: 'Afternoon (2–5)' },
  { label: 'Evening', sub: '6 PM – 8 PM', value: 'Evening (6–8)' },
];

const CATEGORIES: { icon: IoniconName; label: string; tint: string }[] = [
  { icon: 'water', label: 'Plumbing', tint: '#0EA5E9' },
  { icon: 'flash', label: 'Electrical', tint: '#F59E0B' },
  { icon: 'snow', label: 'AC/HVAC', tint: '#06B6D4' },
  { icon: 'hammer', label: 'Carpentry', tint: '#A16207' },
  { icon: 'sparkles', label: 'Cleaning', tint: '#10B981' },
  { icon: 'swap-vertical', label: 'Lift', tint: '#6366F1' },
  { icon: 'shield-checkmark', label: 'Security', tint: '#7C3AED' },
  { icon: 'leaf', label: 'Gardening', tint: '#16A34A' },
];

export default function NewServiceRequestScreen() {
  const t = useTheme();
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const qc = useQueryClient();

  const [category, setCategory] = useState(initialCategory ?? '');
  const [description, setDescription] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePickPhoto = async () => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setPhotoUri(uri);
  };

  const mutation = useMutation<{ id: string }, Error>({
    mutationFn: async () => {
      const sr = await api.post<{ id: string }>('/service-requests', {
        category,
        description,
        preferredTime: preferredTime || undefined,
      });
      // Upload photo (if any) after the SR is created so we have an ID for the presign.
      if (photoUri) {
        try {
          setPhotoUploading(true);
          const presign = await api.post<{ url: string; key: string }>(
            `/service-requests/${sr.id}/photos/presign`,
            { contentType: 'image/jpeg' },
          );
          await uploadToPresignedUrl(photoUri, presign.url, 'image/jpeg');
          await api.post(`/service-requests/${sr.id}/photos`, { key: presign.key });
        } finally {
          setPhotoUploading(false);
        }
      }
      return sr;
    },
    onSuccess: (data: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      router.replace(`/services/${data.id}` as any);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const isValid = category.trim().length > 0 && description.trim().length >= 10;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={20} color="#3B82F6" />
            <Text className="text-primary-500 ml-1" style={{ fontSize: t.fontBase }}>Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 mb-2">New Service Request</Text>
          <Text className="text-gray-500 mb-6" style={{ fontSize: t.fontBase }}>What needs fixing?</Text>

          {/* Category picker */}
          <Text className="font-medium text-gray-700 mb-3" style={{ fontSize: t.fontSm }}>Category *</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => {
              const selected = category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  className="flex-row items-center gap-2 px-3 rounded-xl border"
                  style={{
                    minHeight: t.touchTargetSm,
                    alignItems: 'center',
                    backgroundColor: selected ? cat.tint + '1A' : '#F9FAFB',
                    borderColor: selected ? cat.tint : '#E5E7EB',
                  }}
                  onPress={() => setCategory(cat.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${cat.label} category`}
                >
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center"
                    style={{ backgroundColor: cat.tint + '1A' }}
                  >
                    <Ionicons name={cat.icon} size={16} color={cat.tint} />
                  </View>
                  <Text
                    className="font-medium"
                    style={{ fontSize: t.fontSm, color: selected ? cat.tint : '#374151' }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preferred Time */}
          <Text className="font-medium text-gray-700 mb-3" style={{ fontSize: t.fontSm }}>Preferred Time (optional)</Text>
          <View className="flex-row gap-2 mb-6">
            {PREFERRED_TIMES.map((pt) => (
              <TouchableOpacity
                key={pt.value}
                className={`flex-1 rounded-xl border px-2 py-3 items-center ${
                  preferredTime === pt.value
                    ? 'bg-primary-50 border-primary-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
                onPress={() => setPreferredTime(preferredTime === pt.value ? '' : pt.value)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${pt.label} time slot`}
              >
                <Text className={`font-semibold ${preferredTime === pt.value ? 'text-primary-600' : 'text-gray-700'}`} style={{ fontSize: t.fontSm }}>{pt.label}</Text>
                <Text className="text-gray-400 text-center" style={{ fontSize: 11 }}>{pt.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>Description *</Text>
          <TextInput
            className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 min-h-[120px]"
            style={{ fontSize: t.fontBase }}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />
          <Text className="text-xs text-gray-400 mt-1 text-right">{description.length} chars</Text>

          {/* Photo picker */}
          <Text className="font-medium text-gray-700 mb-1.5 mt-4" style={{ fontSize: t.fontSm }}>Photo (optional)</Text>
          <TouchableOpacity
            onPress={handlePickPhoto}
            className="rounded-xl items-center justify-center py-8 mb-2 overflow-hidden"
            style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}
            accessibilityRole="button"
            accessibilityLabel="Add a photo of the issue"
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 220, height: 140, borderRadius: 12 }} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
                <Text className="text-gray-400 mt-2" style={{ fontSize: t.fontSm }}>Add a photo</Text>
              </>
            )}
          </TouchableOpacity>
          {photoUri && (
            <TouchableOpacity onPress={() => setPhotoUri(null)} className="self-end mb-2">
              <Text className="text-red-500 text-sm">Remove</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-6 mb-4 ${isValid ? 'bg-primary-500' : 'bg-gray-200'}`}
            onPress={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending || photoUploading}
            style={{ minHeight: t.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Submit service request"
          >
            {mutation.isPending || photoUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-semibold ${isValid ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>
                Submit Request
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
