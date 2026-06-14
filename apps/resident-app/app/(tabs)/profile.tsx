import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { useAccessibilityStore } from '../../src/store/accessibility.store';
import { useTheme } from '../../src/hooks/useTheme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type MenuItem = { icon: IoniconName; label: string; route: string; tint: string };

const MENU_ITEMS: MenuItem[] = [
  { icon: 'card', label: 'Maintenance & Dues', route: '/maintenance', tint: '#0EA5E9' },
  { icon: 'restaurant', label: 'Canteen Menu', route: '/canteen', tint: '#D97706' },
  { icon: 'sparkles', label: 'Events', route: '/events', tint: '#DB2777' },
  { icon: 'medkit', label: 'Medical Appointments', route: '/medical', tint: '#16A34A' },
  { icon: 'chatbubble-ellipses', label: 'Complaints & Support', route: '/complaints', tint: '#7C3AED' },
  { icon: 'settings-outline', label: 'Settings', route: '/settings', tint: '#821A52' },
];

export default function ProfileScreen() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const seniorMode = useAccessibilityStore((s) => s.seniorMode);
  const setSeniorMode = useAccessibilityStore((s) => s.setSeniorMode);
  const t = useTheme();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<any>('/residents/me'),
  });

  const directoryMutation = useMutation({
    mutationFn: (visible: boolean) =>
      api.patch('/residents/me/directory-visibility', { visible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resident-profile'] }),
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Could not update directory visibility.'),
  });

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

  const name = profile?.user?.name ?? 'Resident';
  const phone = profile?.user?.phone ?? '';
  const flatNo = profile ? `Flat ${profile.flat.block}-${profile.flat.number}` : '';
  const residentType = profile?.type ?? '';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: t.sectionGap }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-bold text-gray-900" style={{ fontSize: t.font2xl }}>Profile</Text>
            {seniorMode && (
              <View className="bg-primary-50 border border-primary-500 rounded-full px-3 py-1">
                <Text className="text-primary-500 font-semibold" style={{ fontSize: t.fontXs }}>Larger Fonts</Text>
              </View>
            )}
          </View>

          {/* Profile Card */}
          <TouchableOpacity
            className="bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center"
            style={{ padding: t.cardPadding }}
            onPress={() => router.push('/profile/edit' as any)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <View
              className="rounded-full bg-primary-50 items-center justify-center"
              style={{ width: t.iconXl + 16, height: t.iconXl + 16, marginRight: t.cardPadding * 0.75 }}
            >
              <Ionicons name="person-circle" size={t.iconXl + 8} color="#821A52" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold" style={{ fontSize: t.fontLg }}>{name}</Text>
              {phone ? <Text className="text-gray-500" style={{ fontSize: t.fontSm }}>{phone}</Text> : null}
              <Text className="text-gray-400 mt-0.5" style={{ fontSize: t.fontXs }}>
                {flatNo}{residentType ? ` · ${residentType}` : ''}
              </Text>
              <Text className="text-primary-500 font-semibold mt-1" style={{ fontSize: t.fontXs }}>Edit profile →</Text>
            </View>
            <Ionicons name="chevron-forward" size={t.iconSm} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Quick Links</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            {MENU_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                className={`flex-row items-center ${idx < MENU_ITEMS.length - 1 ? 'border-b border-gray-200' : ''}`}
                style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
                onPress={() => router.push(item.route as any)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View
                  className="rounded-full items-center justify-center"
                  style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: `${item.tint}1A` }}
                >
                  <Ionicons name={item.icon} size={t.iconSm} color={item.tint} />
                </View>
                <Text style={{ fontSize: t.fontBase }} className="flex-1 text-gray-900">{item.label}</Text>
                <Ionicons name="chevron-forward" size={t.iconSm} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Accessibility */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Accessibility</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            <View
              className="flex-row items-center"
              style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: '#821A521A' }}
              >
                <Ionicons name="eye-outline" size={t.iconSm} color="#821A52" />
              </View>
              <View className="flex-1 mr-3">
                <Text style={{ fontSize: t.fontBase }} className="text-gray-900 font-semibold">Larger Fonts</Text>
                <Text style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }} className="text-gray-500 mt-0.5">
                  Larger text, bigger buttons, higher contrast
                </Text>
              </View>
              <Switch
                value={seniorMode}
                onValueChange={setSeniorMode}
                trackColor={{ false: '#E5E7EB', true: '#821A52' }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Senior mode toggle. Currently ${seniorMode ? 'on' : 'off'}`}
                accessibilityRole="switch"
              />
            </View>
          </View>
        </View>

        {/* Privacy */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: t.sectionGap }}>
          <Text className="font-semibold text-gray-900 mb-4" style={{ fontSize: t.fontXl }}>Privacy</Text>
          <View className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
            <View
              className="flex-row items-center"
              style={{ minHeight: t.touchTarget, paddingHorizontal: t.cardPadding, paddingVertical: t.cardPadding * 0.75 }}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: t.iconMd + 14, height: t.iconMd + 14, marginRight: 12, backgroundColor: '#821A521A' }}
              >
                <Ionicons name="shield-checkmark" size={t.iconSm} color="#821A52" />
              </View>
              <View className="flex-1 mr-3">
                <Text style={{ fontSize: t.fontBase }} className="text-gray-900 font-semibold">Show in society directory</Text>
                <Text style={{ fontSize: t.fontSm, lineHeight: t.fontSm * t.lineHeightBase }} className="text-gray-500 mt-0.5">
                  Allow other residents to find you
                </Text>
              </View>
              <Switch
                value={profile?.showInDirectory ?? false}
                onValueChange={(val) => directoryMutation.mutate(val)}
                disabled={directoryMutation.isPending}
                trackColor={{ false: '#E5E7EB', true: '#821A52' }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Directory visibility toggle. Currently ${profile?.showInDirectory ? 'on' : 'off'}`}
                accessibilityRole="switch"
              />
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <View style={{ paddingHorizontal: t.screenPadding, marginBottom: 32 }}>
          <TouchableOpacity
            className="bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center justify-center gap-2"
            style={{ minHeight: t.touchTarget, paddingVertical: t.cardPadding * 0.875 }}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign out of your account"
          >
            <Ionicons name="log-out-outline" size={t.iconSm} color="#DC2626" />
            <Text style={{ fontSize: t.fontBase }} className="text-red-600 font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
