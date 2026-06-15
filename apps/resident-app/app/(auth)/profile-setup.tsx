import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

type Flat = {
  id: string;
  block: string;
  floor: number;
  number: string;
};

type OnboardResponse = {
  user?: {
    name?: string;
    status?: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  };
};

export default function ProfileSetupScreen() {
  const societyId = useAuthStore((s) => s.societyId);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [flatId, setFlatId] = useState('');
  const [residentType, setResidentType] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);
  // Flat picker bottom-sheet state. The picker used to render every flat as a
  // long stacked list (200+ rows in larger societies, scroll-hell), so we
  // moved it into a search-filtered modal that opens on demand.
  const [flatPickerOpen, setFlatPickerOpen] = useState(false);
  const [flatSearch, setFlatSearch] = useState('');

  const { data: flats, isLoading } = useQuery<Flat[]>({
    queryKey: ['society-flats', societyId],
    queryFn: () => api.get<Flat[]>(`/societies/${societyId}/flats`),
    enabled: !!societyId,
  });

  const selectedFlat = useMemo(
    () => flats?.find((flat: Flat) => flat.id === flatId),
    [flats, flatId],
  );

  // Case-insensitive search across block, number, and floor. The query is
  // narrow (one society) so we filter client-side; no need for a backend
  // search endpoint.
  const filteredFlats = useMemo(() => {
    if (!flats) return [];
    const q = flatSearch.trim().toLowerCase();
    if (!q) return flats;
    return flats.filter((f) => {
      const label = `${f.block}-${f.number} floor ${f.floor}`.toLowerCase();
      return label.includes(q) || `${f.block}${f.number}`.toLowerCase().includes(q);
    });
  }, [flats, flatSearch]);

  const mutation = useMutation<OnboardResponse>({
    mutationFn: () =>
      api.post<OnboardResponse>('/residents/onboard', {
        name,
        email: email || undefined,
        flatId,
        type: residentType,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        consentAccepted,
      }),
    onSuccess: async (profile: OnboardResponse) => {
      await updateUser({
        name: profile.user?.name ?? name,
        status: profile.user?.status ?? 'PENDING',
      });
      router.replace('/(auth)/documents');
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not save your details. Please try again.'),
  });

  if (!societyId) {
    router.replace('/(auth)/society-select');
    return null;
  }

  const isValid = name.trim().length >= 2 && flatId.length > 0 && consentAccepted;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View className="pt-4 mb-2">
          <TouchableOpacity onPress={() => router.back()} className="py-2 flex-row items-center">
            <Ionicons name="chevron-back" size={20} color="#821A52" />
            <Text className="text-primary-500 text-base ml-1">Back</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-3xl font-bold text-gray-900 mb-2">Complete Your Home Details</Text>
        <Text className="text-base text-gray-500 leading-6 mb-8">
          We'll share this with your society office so they can verify that you live here.
        </Text>

        {/* Name */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-xs font-bold tracking-widest uppercase mb-1">Your name</Text>
          <TextInput
            className="bg-gray-100 rounded-xl p-4 text-gray-900 text-base border border-gray-200 mt-2"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor="#9CA3AF"
            // iOS smart-fill bleeds the previous field's content type into the
            // next field unless each is explicitly typed.
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
          />
        </View>

        {/* Email */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-xs font-bold tracking-widest uppercase mb-1">Email (optional)</Text>
          <TextInput
            className="bg-gray-100 rounded-xl p-4 text-gray-900 text-base border border-gray-200 mt-2"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // Without textContentType="emailAddress", iOS will autofill the
            // previous (phone) field's value here on focus. Same for Android
            // autoComplete. This is the root cause of "phone goes into email".
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>

        {/* Resident type */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-xs font-bold tracking-widest uppercase mb-1">Resident type</Text>
          <View className="flex-row mt-3" style={{ gap: 10 }}>
            {(['OWNER', 'TENANT'] as const).map((option) => {
              const selected = residentType === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setResidentType(option)}
                  className={`flex-1 rounded-xl py-3.5 items-center justify-center min-h-[52px] border ${
                    selected ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-base font-bold ${
                      selected ? 'text-primary-500' : 'text-gray-500'
                    }`}
                  >
                    {option === 'OWNER' ? 'Owner' : 'Tenant'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Flat selection — opens a searchable bottom-sheet picker. Rendering
            the full list inline is painful on larger societies (100+ flats);
            search-then-tap is faster for elderly users too. */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-xs font-bold tracking-widest uppercase mb-3">
            Select your flat
          </Text>
          {isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#821A52" size="large" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setFlatPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={
                selectedFlat
                  ? `Selected flat ${selectedFlat.block} ${selectedFlat.number}. Tap to change.`
                  : 'Choose your flat'
              }
              className={`rounded-xl px-4 py-3.5 min-h-[56px] flex-row items-center justify-between border ${
                selectedFlat ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <View className="flex-1">
                {selectedFlat ? (
                  <>
                    <Text className="text-base font-semibold text-primary-500">
                      Flat {selectedFlat.block}-{selectedFlat.number}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-0.5">Floor {selectedFlat.floor}</Text>
                  </>
                ) : (
                  <Text className="text-base text-gray-500">Choose your flat</Text>
                )}
              </View>
              <Ionicons name="chevron-down" size={20} color="#821A52" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom sheet — searchable list of flats */}
        <Modal
          visible={flatPickerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setFlatPickerOpen(false)}
        >
          {/* Backdrop — tap to dismiss */}
          <Pressable
            onPress={() => setFlatPickerOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <View style={{ flex: 1 }} />
          </Pressable>

          {/* Sheet */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '78%',
              paddingTop: 8,
              paddingBottom: 24,
            }}
          >
            {/* Drag handle */}
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
              <Text className="text-gray-900 text-lg font-bold mb-3">Choose your flat</Text>

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
                  placeholder="Search e.g. A-101 or floor 3"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  className="flex-1 text-gray-900 text-base"
                  style={{ paddingVertical: 12, marginLeft: 8 }}
                />
                {flatSearch ? (
                  <TouchableOpacity
                    onPress={() => setFlatSearch('')}
                    accessibilityLabel="Clear search"
                    hitSlop={10}
                  >
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <FlatList
              data={filteredFlats}
              keyExtractor={(f) => f.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
              ListEmptyComponent={
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text className="text-gray-400 text-base">No flats match "{flatSearch}"</Text>
                </View>
              }
              renderItem={({ item: flat }) => {
                const selected = flat.id === flatId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setFlatId(flat.id);
                      setFlatPickerOpen(false);
                      setFlatSearch('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Flat ${flat.block} ${flat.number}, floor ${flat.floor}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                    }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? '#821A52' : '#9CA3AF'}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text
                        className={`text-base font-semibold ${
                          selected ? 'text-primary-500' : 'text-gray-900'
                        }`}
                      >
                        Flat {flat.block}-{flat.number}
                      </Text>
                      <Text className="text-gray-500 text-sm mt-0.5">Floor {flat.floor}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>

        {/* Emergency contact */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <Text className="text-gray-900 text-xs font-bold tracking-widest uppercase mb-1">Emergency contact</Text>
          <TextInput
            className="bg-gray-100 rounded-xl p-4 text-gray-900 text-base border border-gray-200 mt-2"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Contact person name"
            placeholderTextColor="#9CA3AF"
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
          />
          <TextInput
            className="bg-gray-100 rounded-xl p-4 text-gray-900 text-base border border-gray-200 mt-2.5"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            placeholder="Contact phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            // Explicit phone content type so iOS smart-fill / Android autofill
            // suggest a contact phone, not the user's own phone or email.
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
        </View>

        {/* Consent */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-200">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-gray-900 text-base font-semibold mb-1.5">
                Consent to use my details
              </Text>
              <Text className="text-gray-500 text-sm leading-5">
                Marzi uses this information only for resident verification, notices, billing, and emergency support.
              </Text>
            </View>
            <Switch
              value={consentAccepted}
              onValueChange={setConsentAccepted}
              trackColor={{ false: '#E5E7EB', true: '#F9D5E5' }}
              thumbColor={consentAccepted ? '#821A52' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Summary preview */}
        {selectedFlat && (
          <View className="bg-primary-50 rounded-2xl p-5 mb-4 border border-primary-200">
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkmark-circle" size={16} color="#821A52" />
              <Text className="text-primary-500 text-xs font-bold tracking-widest uppercase ml-1.5">
                Ready to submit
              </Text>
            </View>
            <Text className="text-gray-700 text-base leading-5">
              {name || 'Resident'} will be linked to Flat {selectedFlat.block}-{selectedFlat.number} as an{' '}
              {residentType === 'OWNER' ? 'owner' : 'tenant'}.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
          className={`rounded-2xl h-14 items-center justify-center ${
            isValid ? 'bg-primary-500' : 'bg-primary-200'
          }`}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-bold">Send for Approval</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
