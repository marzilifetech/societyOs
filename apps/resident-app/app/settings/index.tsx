import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { APP_VERSION_LABEL } from '../../src/lib/app-version';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Item = { icon: IoniconName; label: string; route: string; tint: string; description?: string };

// Soft card shadow matching the redesign-kit RoundCard surface.
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
} as const;

const ITEMS: Item[] = [
  { icon: 'notifications-outline', label: 'Notifications', route: '/settings/notifications', tint: '#0EA5E9', description: 'Manage push and email alerts' },
  { icon: 'flask-outline', label: 'Notification test', route: '/settings/notification-test', tint: '#F59E0B', description: 'Send a test notification to this device' },
  { icon: 'eye-outline', label: 'Accessibility', route: '/settings/accessibility', tint: '#7C3AED', description: 'Larger fonts, text size, contrast' },
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
        <View className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6" style={cardShadow}>
          {ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.route}
              className={`flex-row items-center px-4 py-4 ${i < ITEMS.length - 1 ? 'border-b border-gray-100' : ''}`}
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
          className="bg-white border border-gray-100 rounded-2xl flex-row items-center justify-center gap-2 py-4"
          style={{ minHeight: 56, ...cardShadow }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>

        {/* App version — helps support identify exactly which build a user is on. */}
        <Text className="text-center text-gray-400 text-xs mt-6" accessibilityLabel={`App version ${APP_VERSION_LABEL}`}>
          SocietyOS · {APP_VERSION_LABEL}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
