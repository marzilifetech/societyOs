import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Switch, Image } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';
import { useTheme } from '../../src/hooks/useTheme';
import { ScreenHeader, BottomActionBar } from '../../src/components/ui';

// Public Figma reference (Complaint Management frame): node-id=87-6666
// Behaviour-preserving redesign — same /complaints + /upload/presign calls;
// new ScreenHeader + BottomActionBar primitives.

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: { icon: IoniconName; label: string }[] = [
  { icon: 'volume-high', label: 'Noise' },
  { icon: 'car', label: 'Parking' },
  { icon: 'sparkles', label: 'Cleanliness' },
  { icon: 'water', label: 'Water' },
  { icon: 'construct', label: 'Maintenance' },
  { icon: 'people', label: 'Neighbour' },
  { icon: 'paw', label: 'Pets' },
  { icon: 'cube', label: 'Other' },
];

export default function NewComplaintScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoType(asset.mimeType);
      setPhotoName(asset.fileName ?? undefined);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
    setPhotoType(undefined);
    setPhotoName(undefined);
  };

  const mutation = useMutation<{ id: string }, Error>({
    mutationFn: async () => {
      let photoUrl: string | undefined;
      if (photoUri) {
        setUploading(true);
        try {
          const { publicUrl, s3Key } = await uploadViaMedia(photoUri, {
            contentType: photoType,
            filename: photoName,
            visibility: 'public',
          });
          photoUrl = publicUrl ?? s3Key;
        } finally {
          setUploading(false);
        }
      }
      return api.post<{ id: string }>('/complaints', { category, title, description, isAnonymous, photoUrl });
    },
    onSuccess: (data: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      Alert.alert('Submitted', 'Your complaint has been filed.', [
        { text: 'OK', onPress: () => router.replace(`/complaints/${data.id}` as any) },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const isValid =
    category.length > 0 && title.trim().length >= 5 && description.trim().length >= 20;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="File a Complaint" subtitle="We'll review and respond within 48 hours" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-2 pb-3">

          {/* Category */}
          <Text className="font-medium text-gray-700 mb-3" style={{ fontSize: t.fontSm }}>Category *</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => {
              const selected = category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  className={`flex-row items-center gap-1.5 px-3 rounded-xl border ${
                    selected
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                  style={{ minHeight: t.touchTargetSm, alignItems: 'center' }}
                  onPress={() => setCategory(cat.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${cat.label} category`}
                >
                  <Ionicons name={cat.icon} size={16} color={selected ? '#821A52' : '#6B7280'} />
                  <Text
                    className={`font-medium ${
                      selected ? 'text-primary-600' : 'text-gray-700'
                    }`}
                    style={{ fontSize: t.fontSm }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Title */}
          <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>Subject *</Text>
          <TextInput
            className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 mb-4"
            style={{ fontSize: t.fontBase, minHeight: t.touchTarget }}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Loud music after 11 PM"
            placeholderTextColor="#9CA3AF"
          />

          {/* Description */}
          <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>Details *</Text>
          <TextInput
            className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 min-h-[120px]"
            style={{ fontSize: t.fontBase }}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail. Include dates, times, and any relevant context..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />
          <Text className="text-gray-400 mt-1 text-right" style={{ fontSize: t.fontXs }}>{description.length} chars</Text>

          {/* Photo */}
          <Text className="font-medium text-gray-700 mb-1.5 mt-4" style={{ fontSize: t.fontSm }}>Photo Evidence (Optional)</Text>
          {photoUri ? (
            <View className="relative mb-4">
              <Image source={{ uri: photoUri }} className="w-full h-40 rounded-xl" resizeMode="cover" />
              <TouchableOpacity
                className="absolute top-2 right-2 bg-black/60 rounded-full p-2"
                onPress={removePhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove attached photo"
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              className="border border-dashed border-gray-300 bg-gray-50 rounded-xl py-6 mb-4 items-center"
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Add photo evidence"
            >
              <View className="w-12 h-12 rounded-2xl bg-primary-50 items-center justify-center mb-2">
                <Ionicons name="camera-outline" size={24} color="#821A52" />
              </View>
              <Text className="text-gray-500" style={{ fontSize: t.fontSm }}>Add a photo</Text>
            </TouchableOpacity>
          )}

          {/* Anonymous toggle */}
          <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mt-4">
            <View className="flex-1 mr-4">
              <Text className="font-medium text-gray-900" style={{ fontSize: t.fontSm }}>Submit Anonymously</Text>
              <Text className="text-gray-500 mt-0.5" style={{ fontSize: t.fontXs }}>
                Your name won't be shared with management
              </Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: '#E5E7EB', true: '#F5D6E5' }}
              thumbColor={isAnonymous ? '#821A52' : '#9CA3AF'}
              accessibilityLabel="Toggle anonymous submission"
            />
          </View>

          {isAnonymous && (
            <View className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-3 flex-row gap-2">
              <Ionicons name="alert-circle" size={16} color="#B45309" />
              <Text className="text-amber-700 flex-1" style={{ fontSize: t.fontXs, lineHeight: t.fontXs * t.lineHeight }}>
                Anonymous complaints are reviewed but may take longer to resolve as management cannot
                follow up with you directly.
              </Text>
            </View>
          )}

        </View>
      </ScrollView>

      <BottomActionBar
        primary={{
          label: mutation.isPending ? (uploading ? 'Uploading photo…' : 'Submitting…') : 'Submit Complaint',
          onPress: () => mutation.mutate(),
          loading: mutation.isPending,
          disabled: !isValid || mutation.isPending || uploading,
          accessibilityLabel: 'Submit complaint',
        }}
      />
    </View>
  );
}
