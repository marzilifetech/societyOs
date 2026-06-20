import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation } from '@tanstack/react-query';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { api } from '../../src/lib/api';
import { uploadViaMedia } from '../../src/lib/photo-upload';
import { DELIVERY_PARTNERS } from '../../src/constants/delivery-partners';

type FlatRow = {
  flatId: string;
  block: string;
  number: string;
  primaryResidentId: string | null;
  primaryResidentName: string | null;
};

type ResidentLookup = {
  residentId: string;
  flatId: string;
  block: string;
  number: string;
  name: string | null;
};

type VisitorLookup = {
  name: string;
  photoUrl: string | null;
  type: 'GUEST' | 'DELIVERY';
  deliveryPartner: string | null;
};

const PRIMARY = '#1E3A5F';

/**
 * Staff "+ Add Entry" form.
 *
 * Primary path: flat picker → type toggle → photo → submit.
 * Fallback path: resident phone → auto-resolves flat.
 *
 * All form state lives in useState; nothing is persisted across navigations
 * (a guard who backs out of this screen mid-entry is restarting fresh —
 * the assumption is they were interrupted by something else at the gate
 * and want a clean slate when they come back). On successful submit we
 * route to /entry/awaiting/[visitId] which polls until the resident decides.
 */
export default function AddEntryScreen() {
  // ── Form state ─────────────────────────────────────────────────────────
  const [selectedFlat, setSelectedFlat] = useState<FlatRow | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [residentPhone, setResidentPhone] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [type, setType] = useState<'GUEST' | 'DELIVERY'>('GUEST');
  const [partner, setPartner] = useState<string>('');
  const [otherPartner, setOtherPartner] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploadedUrl, setPhotoUploadedUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────
  const [flatPickerOpen, setFlatPickerOpen] = useState(false);
  const [flatSearch, setFlatSearch] = useState('');
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);

  // ── Backend queries ────────────────────────────────────────────────────
  const { data: flats = [], isLoading: flatsLoading } = useQuery({
    queryKey: ['staff-flats'],
    queryFn: async () => {
      const raw = await api.get<object>('/staff/flats');
      return unwrapApiEnvelope<FlatRow[]>(raw);
    },
    staleTime: 5 * 60_000,
  });

  // Resident phone -> resident + flat. Manual trigger via mutation rather
  // than a useQuery key so we can debounce/blur explicitly.
  const lookupResidentPhone = useMutation({
    mutationFn: async (phone: string) => {
      const raw = await api.get<object>(
        `/staff/residents/lookup?phone=${encodeURIComponent(phone)}`,
      );
      return unwrapApiEnvelope<ResidentLookup>(raw);
    },
    onSuccess: (data) => {
      const matching = flats.find((f) => f.flatId === data.flatId);
      if (matching) {
        setSelectedFlat(matching);
        setResidentId(data.residentId);
      } else {
        // Flat is present in DB but the list hasn't refreshed — accept the
        // lookup anyway so submit still works.
        setSelectedFlat({
          flatId: data.flatId,
          block: data.block,
          number: data.number,
          primaryResidentId: data.residentId,
          primaryResidentName: data.name,
        });
        setResidentId(data.residentId);
      }
    },
    onError: (err: Error) => {
      Alert.alert('Resident not found', err?.message ?? 'No resident with that phone.');
    },
  });

  // Visitor phone -> last-known name + photo. Best-effort pre-fill.
  const lookupVisitorPhone = useMutation({
    mutationFn: async (phone: string) => {
      const raw = await api.get<object>(
        `/staff/visitors/lookup?phone=${encodeURIComponent(phone)}`,
      );
      return unwrapApiEnvelope<VisitorLookup>(raw);
    },
    onSuccess: (data) => {
      if (!visitorName && data.name) setVisitorName(data.name);
      if (data.type === 'DELIVERY' && type === 'GUEST') setType('DELIVERY');
      if (data.deliveryPartner && !partner) setPartner(data.deliveryPartner);
    },
    onError: () => {
      // Silent — a missed lookup is normal for new visitors.
    },
  });

  const filteredFlats = useMemo(() => {
    const q = flatSearch.trim().toLowerCase();
    if (!q) return flats;
    return flats.filter((f) => {
      const label = `${f.block}-${f.number} ${f.primaryResidentName ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [flats, flatSearch]);

  // ── Submit ─────────────────────────────────────────────────────────────
  const createEntry = useMutation({
    mutationFn: async () => {
      if (!residentId) throw new Error('Pick a flat or look up by phone first');
      if (!visitorName.trim()) throw new Error('Visitor name is required');
      if (!photoUploadedUrl) throw new Error('Take a photo before submitting');
      const finalPartner =
        type === 'DELIVERY'
          ? partner === 'Other'
            ? `Other: ${otherPartner.trim()}`
            : partner
          : undefined;
      if (type === 'DELIVERY' && !finalPartner) {
        throw new Error('Pick a delivery partner');
      }
      const raw = await api.post<object>('/visitors/at-gate', {
        residentId,
        name: visitorName.trim(),
        phone: visitorPhone.trim() || undefined,
        purpose: purpose.trim() || undefined,
        type,
        deliveryPartner: finalPartner,
        photoUrl: photoUploadedUrl,
      });
      return unwrapApiEnvelope<{ id: string }>(raw);
    },
    onSuccess: (visit) => {
      router.replace(`/entry/awaiting/${visit.id}` as any);
    },
    onError: (err: Error) => {
      Alert.alert('Could not submit', err?.message ?? 'Try again.');
    },
  });

  // ── Photo capture ──────────────────────────────────────────────────────
  const takePhoto = async () => {
    if (photoBusy) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'Open Settings → Permissions → Camera to allow photos.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    setPhotoUploadedUrl(null);
    setPhotoBusy(true);
    try {
      const uploaded = await uploadViaMedia(uri, {
        contentType: 'image/jpeg',
        visibility: 'public',
        filename: `entry-${Date.now()}.jpg`,
      });
      if (!uploaded.publicUrl) {
        throw new Error('Upload did not return a URL');
      }
      setPhotoUploadedUrl(uploaded.publicUrl);
    } catch (err: any) {
      Alert.alert('Photo upload failed', err?.message ?? 'Try the photo again.');
      setPhotoUri(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  const canSubmit =
    !!residentId && visitorName.trim().length > 0 && !!photoUploadedUrl && !createEntry.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text className="ml-2 text-lg font-bold text-gray-900 dark:text-gray-100 flex-1">
          Add Entry
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1 — flat picker */}
          <Section title="1. Which flat?">
            <TouchableOpacity
              onPress={() => setFlatPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Pick a flat"
              className="flex-row items-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5"
            >
              <Ionicons name="home" size={20} color={PRIMARY} />
              <View className="ml-3 flex-1">
                {selectedFlat ? (
                  <>
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Flat {selectedFlat.block}-{selectedFlat.number}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedFlat.primaryResidentName ?? 'No resident assigned'}
                    </Text>
                  </>
                ) : (
                  <Text className="text-base text-gray-500">Search by flat number or resident name</Text>
                )}
              </View>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">
              Don&apos;t know the flat? Try the resident&apos;s phone:
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={residentPhone}
                onChangeText={setResidentPhone}
                onBlur={() => {
                  const trimmed = residentPhone.trim();
                  if (trimmed.length >= 4) lookupResidentPhone.mutate(trimmed);
                }}
                placeholder="+91 98765 43210"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100"
              />
              {lookupResidentPhone.isPending && (
                <ActivityIndicator color={PRIMARY} style={{ marginLeft: 8 }} />
              )}
            </View>
          </Section>

          {/* Section 2 — visitor identity */}
          <Section title="2. Who's here?">
            <Field label="Visitor name">
              <TextInput
                value={visitorName}
                onChangeText={setVisitorName}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100"
              />
            </Field>
            <Field label="Visitor phone (optional)">
              <View className="flex-row items-center">
                <TextInput
                  value={visitorPhone}
                  onChangeText={setVisitorPhone}
                  onBlur={() => {
                    const trimmed = visitorPhone.trim();
                    if (trimmed.length >= 4) lookupVisitorPhone.mutate(trimmed);
                  }}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100"
                />
                {lookupVisitorPhone.isPending && (
                  <ActivityIndicator color={PRIMARY} style={{ marginLeft: 8 }} />
                )}
              </View>
            </Field>
            <Field label="Purpose of visit (optional)">
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                placeholder="e.g. Delivery, Guest, Housekeeping"
                placeholderTextColor="#9CA3AF"
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100"
              />
            </Field>
          </Section>

          {/* Section 3 — type toggle */}
          <Section title="3. Guest or delivery?">
            <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <ToggleOption
                label="Guest"
                icon="person"
                selected={type === 'GUEST'}
                onPress={() => setType('GUEST')}
              />
              <ToggleOption
                label="Delivery"
                icon="cube"
                selected={type === 'DELIVERY'}
                onPress={() => setType('DELIVERY')}
              />
            </View>

            {type === 'DELIVERY' && (
              <View className="mt-3">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Which delivery partner?
                </Text>
                <TouchableOpacity
                  onPress={() => setPartnerPickerOpen(true)}
                  accessibilityRole="button"
                  className="flex-row items-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5"
                >
                  <Ionicons name="bicycle" size={18} color={PRIMARY} />
                  <Text
                    className={`flex-1 ml-3 text-base ${
                      partner ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {partner === 'Other'
                      ? `Other: ${otherPartner || '...'}`
                      : partner || 'Pick a partner'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {partner === 'Other' && (
                  <TextInput
                    value={otherPartner}
                    onChangeText={setOtherPartner}
                    placeholder="Type the courier name"
                    placeholderTextColor="#9CA3AF"
                    maxLength={60}
                    className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100"
                  />
                )}
              </View>
            )}
          </Section>

          {/* Section 4 — photo */}
          <Section title="4. Photo (required)">
            <TouchableOpacity
              onPress={takePhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
              className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center"
              style={{ height: 200, opacity: photoBusy ? 0.7 : 1 }}
            >
              {photoUri ? (
                <View style={{ width: '100%', height: '100%' }}>
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: '100%', height: '100%', borderRadius: 14 }}
                    resizeMode="cover"
                  />
                  {photoBusy ? (
                    <View
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 14,
                      }}
                    >
                      <ActivityIndicator color="#fff" size="large" />
                    </View>
                  ) : null}
                  {!photoBusy && photoUploadedUrl && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        backgroundColor: '#16A34A',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                        Uploaded ✓
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View className="items-center">
                  <Ionicons name="camera" size={36} color={PRIMARY} />
                  <Text className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                    Take a photo
                  </Text>
                  <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Camera only — no gallery uploads
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && !photoBusy && (
              <TouchableOpacity onPress={takePhoto} className="mt-2 self-center">
                <Text className="text-sm font-semibold text-primary-600">Retake</Text>
              </TouchableOpacity>
            )}
          </Section>
        </ScrollView>

        {/* Submit bar (sticky) */}
        <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          <TouchableOpacity
            onPress={() => createEntry.mutate()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Submit entry"
            className="rounded-xl items-center justify-center py-4"
            style={{
              backgroundColor: canSubmit ? PRIMARY : '#9CA3AF',
            }}
          >
            {createEntry.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Submit entry</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Flat picker bottom sheet */}
      <Modal
        visible={flatPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFlatPickerOpen(false)}
      >
        <Pressable
          onPress={() => setFlatPickerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View style={{ flex: 1 }} />
        </Pressable>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '80%',
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: '#D1D5DB',
              marginBottom: 12,
            }}
          />
          <View style={{ paddingHorizontal: 20 }}>
            <Text className="text-gray-900 text-lg font-bold mb-3">Choose flat</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 12,
                marginBottom: 12,
              }}
            >
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                value={flatSearch}
                onChangeText={setFlatSearch}
                placeholder="Search e.g. A-302 or Sharma"
                placeholderTextColor="#9CA3AF"
                autoFocus
                autoCorrect={false}
                className="flex-1 text-gray-900 text-base"
                style={{ paddingVertical: 12, marginLeft: 8 }}
              />
              {flatSearch ? (
                <TouchableOpacity onPress={() => setFlatSearch('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {flatsLoading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={filteredFlats}
              keyExtractor={(f) => f.flatId}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
              ListEmptyComponent={
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text className="text-gray-400 text-base">
                    {flatSearch ? `No flats match "${flatSearch}"` : 'No flats yet'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const selected = item.flatId === selectedFlat?.flatId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedFlat(item);
                      setResidentId(item.primaryResidentId);
                      setFlatPickerOpen(false);
                      setFlatSearch('');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? PRIMARY : '#9CA3AF'}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text
                        className={`text-base font-semibold ${
                          selected ? 'text-primary-600' : 'text-gray-900'
                        }`}
                      >
                        Flat {item.block}-{item.number}
                      </Text>
                      <Text className="text-gray-500 text-sm mt-0.5">
                        {item.primaryResidentName ?? 'No resident assigned'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Partner picker — simple modal list. Always includes "Other" at the
          bottom so a partner not on the list still has a clean path. */}
      <Modal
        visible={partnerPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPartnerPickerOpen(false)}
      >
        <Pressable
          onPress={() => setPartnerPickerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View style={{ flex: 1 }} />
        </Pressable>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '70%',
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: '#D1D5DB',
              marginBottom: 12,
            }}
          />
          <Text className="text-gray-900 text-lg font-bold mb-2 px-5">Delivery partner</Text>
          <FlatList
            data={[...DELIVERY_PARTNERS, 'Other']}
            keyExtractor={(p) => p}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
            renderItem={({ item }) => {
              const selected = partner === item;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setPartner(item);
                    setPartnerPickerOpen(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? PRIMARY : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-3 text-base ${
                      selected
                        ? 'font-bold text-primary-600'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</Text>
      {children}
    </View>
  );
}

function ToggleOption({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 rounded-lg items-center justify-center flex-row py-3 ${
        selected ? 'bg-white dark:bg-gray-700 shadow' : ''
      }`}
    >
      <Ionicons name={icon} size={18} color={selected ? PRIMARY : '#6B7280'} />
      <Text
        className={`ml-2 text-base ${
          selected ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-500'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
