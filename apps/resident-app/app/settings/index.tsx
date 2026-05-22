import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Item = { icon: IoniconName; label: string; route: string; tint: string; description?: string };

const ITEMS: Item[] = [
  { icon: 'notifications-outline', label: 'Notifications', route: '/settings/notifications', tint: '#0EA5E9', description: 'Manage push and email alerts' },
  { icon: 'eye-outline', label: 'Accessibility', route: '/settings/accessibility', tint: '#7C3AED', description: 'Senior mode, text size, contrast' },
  { icon: 'language-outline', label: 'Language', route: '/settings/language', tint: '#16A34A', description: 'Change app language' },
];

export default function SettingsScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/society-select');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 }}>
        <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden mb-6">
          {ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.route}
              className={`flex-row items-center px-4 py-4 ${i < ITEMS.length - 1 ? 'border-b border-gray-200' : ''}`}
              style={{ minHeight: 64 }}
              onPress={() => router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View className="rounded-full items-center justify-center mr-3" style={{ width: 36, height: 36, backgroundColor: `${item.tint}1A` }}>
                <Ionicons name={item.icon} size={18} color={item.tint} />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-base font-semibold">{item.label}</Text>
                {item.description && <Text className="text-gray-500 text-xs mt-0.5">{item.description}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center justify-center gap-2 py-4"
          style={{ minHeight: 56 }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
