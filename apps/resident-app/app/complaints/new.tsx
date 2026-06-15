import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  rd,
} from '../../src/components/ui';

// Figma reference: Complaints Management-3.jpg (form), -4.jpg (filled+anon), -5.jpg (success sheet)
// Preserves existing API shape: POST /complaints { category, title, description, isAnonymous, photoUrl }
// Note: Figma form drops separate "title" field — title is derived from category on submit
//       to match existing API contract (category required, title required by backend).
// category label → backend enum value map
const CATEGORY_ENUM: Record<string, string> = {
  Noise: 'NOISE',
  Cleanliness: 'CLEANLINESS',
  Parking: 'PARKING',
  Water: 'WATER',
  Maintenance: 'MAINTENANCE',
  Neighbour: 'NEIGHBOR',
  Pets: 'PETS',
  Other: 'OTHER',
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: { icon: IoniconName; label: string; bg: string }[] = [
  { icon: 'volume-high-outline', label: 'Noise', bg: rd.crimsonSoft },
  { icon: 'car-outline', label: 'Parking', bg: rd.crimsonSoft },
  { icon: 'sparkles-outline', label: 'Cleanliness', bg: rd.greenSoft },
  { icon: 'water-outline', label: 'Water', bg: '#EAF4FB' },
  { icon: 'construct-outline', label: 'Maintenance', bg: rd.inkSoft },
  { icon: 'people-outline', label: 'Neighbour', bg: rd.greenSoft },
  { icon: 'paw-outline', label: 'Pets', bg: rd.amberSoft },
  { icon: 'help-circle-outline', label: 'Other', bg: '#EAF4FB' },
];

function fmtDateShort(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function NewComplaintScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ category?: string }>();

  const [category, setCategory] = useState(params.category ?? '');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  // Success sheet state
  const [successData, setSuccessData] = useState<{ id: string; createdAt: string; category: string } | null>(null);

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

  const mutation = useMutation<{ id: string; createdAt?: string }, Error>({
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
      // Derive title from category (backend requires title; Figma form omits it)
      const title = category;
      // Map display label → backend enum value
      const categoryEnum = CATEGORY_ENUM[category] ?? category.toUpperCase();
      // Backend requires description String; send label as fallback when user left it blank
      const descriptionPayload = description.trim().length > 0 ? description.trim() : category;
      return api.post<{ id: string; createdAt?: string }>('/complaints', {
        category: categoryEnum,
        title,
        description: descriptionPayload,
        isAnonymous,
        photoUrl,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      setSuccessData({
        id: data.id,
        createdAt: data.createdAt ?? new Date().toISOString(),
        category,
      });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const isValid = category.length > 0;
  const selectedCat = CATEGORIES.find((c) => c.label === category);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title={category || 'Raise a Complaint'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category selector — only shown if no category was passed via params */}
          {!params.category && (
            <>
              <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary, marginBottom: 12 }}>
                Select Category
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {CATEGORIES.map((cat) => {
                  const sel = category === cat.label;
                  return (
                    <TouchableOpacity
                      key={cat.label}
                      onPress={() => setCategory(cat.label)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${cat.label} category`}
                      accessibilityState={{ selected: sel }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: rd.radiusPill,
                        borderWidth: 1.5,
                        borderColor: sel ? rd.ink : rd.cardBorder,
                        backgroundColor: sel ? rd.ink : '#FFFFFF',
                      }}
                    >
                      <Ionicons name={cat.icon} size={15} color={sel ? '#FFFFFF' : t.textSecondary} />
                      <Text style={{ fontSize: t.fontSm, color: sel ? '#FFFFFF' : t.textPrimary, fontWeight: '600' }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Description */}
          <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary, marginBottom: 10 }}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={t.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            style={{
              minHeight: 120,
              borderRadius: rd.radiusInput,
              borderWidth: 1,
              borderColor: rd.cardBorder,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: t.fontBase,
              color: t.textPrimary,
              marginBottom: 24,
            }}
          />

          {/* Photo */}
          <Text style={{ fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary, marginBottom: 10 }}>
            Photo (optional)
          </Text>
          {photoUri ? (
            <View style={{ marginBottom: 20 }}>
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 160, borderRadius: rd.radiusCard, marginBottom: 8 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={removePhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove attached photo"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 99,
                  padding: 6,
                }}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Add photo evidence"
              style={{
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: rd.cardBorder,
                borderRadius: rd.radiusCard,
                paddingVertical: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rd.inkSoft,
                marginBottom: 20,
                gap: 8,
              }}
            >
              <IconCircle size={48} bg="#FFFFFF">
                <Ionicons name="camera-outline" size={22} color={t.textSecondary} />
              </IconCircle>
              <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>Add a photo</Text>
            </TouchableOpacity>
          )}

          {/* Submit Anonymously toggle */}
          <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                  Submit Anonymously
                </Text>
                <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>
                  Your identity won't be shared with admin
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: rd.cardBorder, true: t.accentPrimary }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle anonymous submission"
              />
            </View>
          </RoundCard>
        </ScrollView>

        {/* Footer */}
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
        >
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
            <PillButton
              label={
                mutation.isPending
                  ? uploading
                    ? 'Uploading…'
                    : 'Submitting…'
                  : 'Submit Complaint'
              }
              tone={isValid ? 'dark' : 'light'}
              onPress={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!isValid || mutation.isPending || uploading}
              accessibilityLabel="Submit complaint"
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Success bottom sheet */}
      <Modal
        visible={!!successData}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSuccessData(null);
          router.replace('/complaints' as any);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              setSuccessData(null);
              router.replace('/complaints' as any);
            }}
          />
          <SafeAreaView
            edges={['bottom']}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}
          >
            {/* Green gradient beacon area */}
            <LinearGradient
              colors={['#C8E6D4', '#E7F4EC']}
              style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 36 }}
            >
              <TouchableOpacity
                onPress={() => {
                  setSuccessData(null);
                  router.replace('/complaints' as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={rd.ink} />
              </TouchableOpacity>
              {/* Concentric green circles */}
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: 'rgba(46,158,91,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: 'rgba(46,158,91,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: rd.green,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={34} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </LinearGradient>

            <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 8 }}>
              <Display size="md">Complaint Raised{'\n'}Successfully!</Display>

              <View style={{ marginTop: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar-outline" size={16} color={t.textMuted} />
                  <Text style={{ fontSize: t.fontSm, color: t.textSecondary }}>
                    {successData ? fmtDateShort(successData.createdAt) : ''}
                  </Text>
                </View>
                {successData?.category ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontSm, color: t.textSecondary }}>{successData.category}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 10, marginTop: 24 }}>
                <PillButton
                  label="Track Complaint"
                  tone="dark"
                  onPress={() => {
                    const id = successData?.id;
                    setSuccessData(null);
                    if (id) router.replace(`/complaints/${id}` as any);
                  }}
                />
                <PillButton
                  label="Back to Complaints"
                  tone="light"
                  onPress={() => {
                    setSuccessData(null);
                    router.replace('/complaints' as any);
                  }}
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
