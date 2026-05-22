import { useState } from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Switch } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { FREQUENCY_PRESETS, type Day } from '../../src/lib/visitorConfig';
import { DateField } from '../../src/components/common/DateField';

const ALL_DAYS: readonly Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type VisitorForm = {
  name: string;
  phone: string;
  purpose: string;
  vehicleNo: string;
};

type CreateVisitorResponse = {
  id: string;
  qrToken: string;
};

async function uploadPhoto(uri: string): Promise<string> {
  const { url, key } = await api.post<{ url: string; key: string }>('/upload/presign', {
    contentType: 'image/jpeg',
    folder: 'visitors',
  });
  // S3 presigned PUT requires the raw file body — NOT FormData.
  const blob = await fetch(uri).then((r) => r.blob());
  const res = await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!res.ok) throw new Error(`Photo upload failed: ${res.status}`);
  return key;
}

export default function NewVisitorScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [form, setForm] = useState<VisitorForm>({ name: '', phone: '', purpose: '', vehicleNo: '' });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Day[]>([]);
  const [recurringUntil, setRecurringUntil] = useState('');

  const pickPhoto = async (useCamera: boolean) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      if (!result.canceled) setPhotoUri(result.assets[0].uri);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      if (!result.canceled) setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('Visitor Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickPhoto(true) },
      { text: 'Choose from Gallery', onPress: () => pickPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const toggleDay = (day: Day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const applyPreset = (days: Day[]) => setSelectedDays(days);

  const mutation = useMutation<CreateVisitorResponse, Error, VisitorForm>({
    mutationFn: async (data: VisitorForm) => {
      let photoUrl: string | undefined;
      if (photoUri) {
        setUploading(true);
        try {
          photoUrl = await uploadPhoto(photoUri);
        } finally {
          setUploading(false);
        }
      }
      const payload: Record<string, unknown> = { ...data, photoUrl };
      if (isRecurring) {
        payload.isRecurring = true;
        payload.recurringDays = selectedDays;
        if (recurringUntil) payload.recurringUntil = recurringUntil;
      }
      return api.post<CreateVisitorResponse>('/visitors', payload);
    },
    onSuccess: (data: CreateVisitorResponse) => {
      qc.invalidateQueries({ queryKey: ['my-visitors'] });
      router.replace({ pathname: '/visitor/[id]', params: { id: data.id } } as any);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const isValid =
    form.name.trim().length >= 2 && (!isRecurring || selectedDays.length > 0);
  const isPending = mutation.isPending || uploading;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center"
          >
            <Ionicons name="chevron-back" size={20} color="#821A52" />
            <Text className="text-primary-500" style={{ fontSize: t.fontBase }}>Back</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 pt-2 pb-8">
          <Text className="text-2xl font-bold text-gray-900 mb-2">Invite a Visitor</Text>
          <Text className="text-gray-500 mb-8" style={{ fontSize: t.fontBase, lineHeight: t.fontBase * t.lineHeight }}>
            They&apos;ll receive a gate pass code valid for 24 hours
          </Text>

          <Field label="Full Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Rajan Mehta" />
          <Field label="Phone (optional)" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
          <Field label="Purpose of Visit" value={form.purpose} onChange={(v) => setForm((f) => ({ ...f, purpose: v }))} placeholder="e.g. Delivery, Housekeeping, Guest" />
          <Field label="Vehicle Number" value={form.vehicleNo} onChange={(v) => setForm((f) => ({ ...f, vehicleNo: v }))} placeholder="e.g. MH 01 AB 1234" />

          {/* Photo KYC */}
          <Text className="font-medium text-gray-700 mb-1.5 mt-1" style={{ fontSize: t.fontSm }}>Visitor Photo (Optional)</Text>
          <View className="flex-row items-center gap-4 mb-6">
            {photoUri ? (
              <>
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: 80, height: 100, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <View className="flex-1 gap-2">
                  <TouchableOpacity
                    onPress={handlePhotoPress}
                    className="border border-gray-200 rounded-xl items-center justify-center"
                    style={{ minHeight: t.touchTargetSm, paddingHorizontal: 16 }}
                    accessibilityRole="button"
                    accessibilityLabel="Retake visitor photo"
                  >
                    <Text className="text-primary-500 font-medium" style={{ fontSize: t.fontSm }}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPhotoUri(null)}
                    className="border border-gray-200 rounded-xl items-center justify-center"
                    style={{ minHeight: t.touchTargetSm, paddingHorizontal: 16 }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove visitor photo"
                  >
                    <Text className="text-gray-400 font-medium" style={{ fontSize: t.fontSm }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                onPress={handlePhotoPress}
                className="border border-dashed border-gray-300 rounded-xl items-center justify-center flex-1"
                style={{ minHeight: 100 }}
                accessibilityRole="button"
                accessibilityLabel="Take or choose visitor photo"
              >
                <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
                <Text className="text-gray-500 font-medium mt-1" style={{ fontSize: t.fontSm }}>Take Photo / Choose from Gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Recurring toggle */}
          <View className="flex-row items-center justify-between mb-4 mt-2">
            <View className="flex-1">
              <Text className="font-medium text-gray-700" style={{ fontSize: t.fontSm }}>Recurring Pass</Text>
              <Text className="text-gray-400" style={{ fontSize: t.fontSm - 1 }}>Allow entry on selected days</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: '#E5E7EB', true: '#821A52' }}
              thumbColor="#fff"
              accessibilityLabel="Toggle recurring pass"
            />
          </View>

          {isRecurring && (
            <View className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              {/* Presets */}
              <Text className="font-medium text-gray-700 mb-2" style={{ fontSize: t.fontSm }}>Frequency</Text>
              <View className="flex-row gap-2 mb-4">
                {FREQUENCY_PRESETS.map((preset) => {
                  const active =
                    preset.days.length === selectedDays.length &&
                    preset.days.every((d) => selectedDays.includes(d));
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => applyPreset(preset.days)}
                      className={`rounded-xl px-3 items-center justify-center border ${active ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
                      style={{ minHeight: t.touchTargetSm }}
                      accessibilityRole="button"
                      accessibilityLabel={`Set frequency to ${preset.label}`}
                    >
                      <Text className={active ? 'text-white font-semibold' : 'text-gray-600'} style={{ fontSize: t.fontSm }}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Day picker */}
              <Text className="font-medium text-gray-700 mb-2" style={{ fontSize: t.fontSm }}>Days *</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(day)}
                      className={`rounded-xl items-center justify-center border ${active ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
                      style={{ minHeight: t.touchTargetSm, minWidth: 48 }}
                      accessibilityRole="button"
                      accessibilityLabel={`${active ? 'Deselect' : 'Select'} ${day}`}
                    >
                      <Text className={active ? 'text-white font-semibold' : 'text-gray-600'} style={{ fontSize: t.fontSm }}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* End date */}
              <DateField label="Valid Until (optional)" value={recurringUntil} onChange={(iso) => setRecurringUntil(iso.slice(0, 10))} mode="date" minimumDate={new Date()} />
            </View>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-4 ${isValid ? 'bg-primary-500' : 'bg-gray-200'}`}
            onPress={() => mutation.mutate(form)}
            disabled={!isValid || isPending}
            style={{ minHeight: t.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Add visitor to expected list"
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-semibold ${isValid ? 'text-white' : 'text-gray-400'}`} style={{ fontSize: t.fontBase }}>
                Generate Gate Pass
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: KeyboardTypeOptions;
}) {
  const t = useTheme();
  return (
    <View className="mb-5">
      <Text className="font-medium text-gray-700 mb-1.5" style={{ fontSize: t.fontSm }}>{label}</Text>
      <TextInput
        className="bg-gray-50 border border-gray-100 rounded-xl px-4 text-gray-900"
        style={{ fontSize: t.fontBase, minHeight: t.touchTarget, paddingVertical: 12 }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
      />
    </View>
  );
}
