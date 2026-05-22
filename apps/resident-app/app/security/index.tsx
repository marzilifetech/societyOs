import { View, Text, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

const CONTACTS: { label: string; number: string; icon: IoniconName }[] = [
  { label: 'Security Desk', number: '+91 98765 43210', icon: 'shield-checkmark' },
  { label: 'Emergency (Police)', number: '100', icon: 'car-sport' },
  { label: 'Fire Brigade', number: '101', icon: 'flame' },
  { label: 'Ambulance', number: '108', icon: 'medkit' },
];

export default function SecurityScreen() {
  const callNumber = (number: string, label: string) => {
    const url = `tel:${number.replace(/\s/g, '')}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Cannot Call', `Please call ${label} at ${number} manually.`);
      }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 min-h-[44px] min-w-[44px] justify-center">
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
            Call security immediately using the numbers below. Our security team is on duty 24/7.
          </Text>
        </View>

        <Text className="text-gray-500 text-xs font-semibold mb-3 tracking-wider">CONTACT NUMBERS</Text>

        {CONTACTS.map((contact) => (
          <TouchableOpacity
            key={contact.number}
            onPress={() => callNumber(contact.number, contact.label)}
            className="bg-gray-50 rounded-2xl p-4 mb-2.5 flex-row items-center border border-gray-200 min-h-[64px]"
            activeOpacity={0.7}
          >
            <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center mr-3.5">
              <Ionicons name={contact.icon} size={22} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-base font-semibold">{contact.label}</Text>
              <Text className="text-gray-500 text-sm mt-0.5">{contact.number}</Text>
            </View>
            <Text className="text-primary-500 text-sm font-semibold">Call</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
