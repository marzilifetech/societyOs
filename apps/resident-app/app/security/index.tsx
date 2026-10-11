import { View, Text, TouchableOpacity, Linking, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import {
  NATIONAL_EMERGENCY_NUMBERS,
  readEmergencyContacts,
  type EmergencyContact,
} from '../../src/utils/emergency-contacts';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Who to call in an emergency: the society's own numbers (set by the admin),
 * then the national ones. The "Security Desk" entry used to be a made-up
 * placeholder number.
 */
export default function SecurityScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get<unknown>('/residents/society/emergency-contacts'),
    staleTime: 30 * 60_000,
  });
  const society = readEmergencyContacts(data);

  const callNumber = (number: string, label: string) => {
    const url = `tel:${number.replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Alert.alert('Cannot call', `Please call ${label} at ${number}.`));
  };

  const row = (contact: EmergencyContact, icon: IoniconName) => (
    <TouchableOpacity
      key={`${contact.label}-${contact.phone}`}
      onPress={() => callNumber(contact.phone, contact.label)}
      accessibilityRole="button"
      accessibilityLabel={`Call ${contact.label}, ${contact.phone}`}
      className="bg-gray-50 rounded-2xl p-4 mb-2.5 flex-row items-center border border-gray-200 min-h-[64px]"
      activeOpacity={0.7}
    >
      <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center mr-3.5">
        <Ionicons name={icon} size={22} color="#821A52" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 text-base font-semibold">{contact.label}</Text>
        <Text className="text-gray-500 text-sm mt-0.5">{contact.phone}</Text>
      </View>
      <Text className="text-primary-500 text-sm font-semibold">Call</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-3 min-h-[44px] min-w-[44px] justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-gray-900 text-2xl font-bold">Security</Text>
          <Text className="text-gray-500 text-sm">Emergency contacts</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View className="bg-red-100 rounded-2xl p-4 mb-6 border border-red-200">
          <View className="flex-row items-center mb-1">
            <Ionicons name="alert-circle" size={18} color="#B91C1C" />
            <Text className="text-red-700 text-sm font-semibold ml-1.5">In an emergency</Text>
          </View>
          <Text className="text-gray-700 text-sm leading-5">
            Call your society's security first. For police, fire or an ambulance, call 112.
          </Text>
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-3 tracking-wider">YOUR SOCIETY</Text>
        {isLoading ? (
          <ActivityIndicator color="#821A52" style={{ marginVertical: 16 }} />
        ) : isError ? (
          <TouchableOpacity onPress={() => refetch()} accessibilityRole="button" className="mb-4">
            <Text className="text-gray-500 text-sm">Couldn't load your society's numbers. Tap to retry.</Text>
          </TouchableOpacity>
        ) : society.length === 0 ? (
          <Text className="text-gray-500 text-sm mb-4">
            Your society hasn't added its security numbers yet. Ask the office to add them.
          </Text>
        ) : (
          society.map((c) => row(c, /security|guard|gate/i.test(c.label) ? 'shield-checkmark' : 'call'))
        )}

        <Text className="text-gray-500 text-xs font-semibold mt-4 mb-3 tracking-wider">NATIONAL NUMBERS</Text>
        {NATIONAL_EMERGENCY_NUMBERS.map((c, i) => row(c, (['alert-circle', 'car-sport', 'flame', 'medkit'] as IoniconName[])[i]))}
      </ScrollView>
    </SafeAreaView>
  );
}
