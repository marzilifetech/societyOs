import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { api } from '../../src/lib/api';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ResidentProfile = {
  user?: { name?: string };
  flat?: { block: string; number: string };
};

type ServiceRequestSummary = {
  id: string;
  category: string;
  description: string;
  status: string;
};

type Notice = { id: string; isRead: boolean };
type PinnedNotice = { id: string; title: string; body: string; isPinned: boolean; category?: string };
type EmergencyContact = { id?: string; label: string; phone: string; icon?: IoniconName; tint?: string };
type SocietyResponse = { id: string; config?: { emergencyContacts?: EmergencyContact[] } };

const DISMISSED_PINNED_KEY = 'dismissed_pinned_notice_ids';

const DEFAULT_CONTACT_META: Record<string, { icon: IoniconName; tint: string }> = {
  Medical: { icon: 'medkit', tint: '#16A34A' },
  Security: { icon: 'shield-checkmark', tint: '#2563EB' },
  Fire: { icon: 'flame', tint: '#DC2626' },
  Manager: { icon: 'person', tint: '#7C3AED' },
  Plumber: { icon: 'water', tint: '#0EA5E9' },
  Electrician: { icon: 'flash', tint: '#F59E0B' },
};

type QuickAction = { icon: IoniconName; label: string; route: string; tint: string };

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'warning', label: 'SOS', route: '/medical/sos', tint: '#DC2626' },
  { icon: 'people', label: 'Visitor', route: '/visitor/new', tint: '#2563EB' },
  { icon: 'construct', label: 'Services', route: '/services', tint: '#F97316' },
  { icon: 'medkit', label: 'Medical', route: '/medical', tint: '#16A34A' },
  { icon: 'restaurant', label: 'Canteen', route: '/canteen', tint: '#D97706' },
  { icon: 'card', label: 'Payments', route: '/maintenance', tint: '#0EA5E9' },
  { icon: 'chatbubble-ellipses', label: 'Complaints', route: '/complaints', tint: '#7C3AED' },
  { icon: 'megaphone', label: 'Notices', route: '/notices', tint: '#0891B2' },
  { icon: 'sparkles', label: 'Events', route: '/events', tint: '#DB2777' },
  { icon: 'airplane', label: 'Travel', route: '/travel', tint: '#0284C7' },
  { icon: 'home', label: 'Property', route: '/property', tint: '#65A30D' },
  { icon: 'qr-code', label: 'Scan QR', route: '/scan', tint: '#475569' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);

  const { data: profile, refetch: refetchProfile } = useQuery<ResidentProfile>({
    queryKey: ['resident-profile'],
    queryFn: () => api.get<ResidentProfile>('/residents/me'),
  });

  const { data: recentRequests, refetch: refetchRequests } = useQuery<ServiceRequestSummary[]>({
    queryKey: ['my-service-requests'],
    queryFn: () => api.get<ServiceRequestSummary[]>('/service-requests/my'),
  });

  const { data: notices } = useQuery<Notice[]>({
    queryKey: ['notices-summary'],
    queryFn: () => api.get<Notice[]>('/notices?limit=20'),
  });

  const { data: pinnedNotices } = useQuery<PinnedNotice[]>({
    queryKey: ['notices-pinned'],
    queryFn: () => api.get<PinnedNotice[]>('/notices?pinned=true&limit=1'),
  });

  const { data: societyContacts } = useQuery<SocietyResponse>({
    queryKey: ['resident-society-contacts'],
    queryFn: () => api.get<SocietyResponse>('/residents/society/emergency-contacts'),
    staleTime: 5 * 60 * 1000,
  });

  const [dismissedPinnedIds, setDismissedPinnedIds] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_PINNED_KEY).then((raw) => {
      if (!raw) return;
      try { setDismissedPinnedIds(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, []);

  const visiblePinned = pinnedNotices?.find((n) => !dismissedPinnedIds.includes(n.id));

  const dismissPinned = async (id: string) => {
    const next = [...dismissedPinnedIds, id];
    setDismissedPinnedIds(next);
    await AsyncStorage.setItem(DISMISSED_PINNED_KEY, JSON.stringify(next));
  };

  const emergencyContacts: EmergencyContact[] = (societyContacts?.config?.emergencyContacts ?? []).slice(0, 4);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchRequests()]);
    setRefreshing(false);
  };

  const firstName = profile?.user?.name?.split(' ')[0] ?? 'Resident';
  const flatNo = profile?.flat ? `${profile.flat.block}-${profile.flat.number}` : '';
  const unreadNotices = notices?.filter((n: Notice) => !n.isRead).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row justify-between items-start mb-6">
            <View>
              <Text className="text-sm text-gray-500">{getGreeting()},</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-0.5">{firstName}</Text>
              {flatNo ? (
                <Text className="text-sm text-primary-500 mt-0.5">Flat {flatNo}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              className="bg-gray-100 border border-gray-200 rounded-full w-11 h-11 items-center justify-center"
              onPress={() => router.push('/notices' as any)}
              accessibilityRole="button"
              accessibilityLabel={unreadNotices > 0 ? `Notifications, ${unreadNotices} unread` : 'Notifications'}
            >
              <Ionicons name="notifications-outline" size={22} color="#374151" />
              {unreadNotices > 0 && (
                <View className="absolute top-1 right-1 bg-primary-500 min-w-[16px] h-4 rounded-full items-center justify-center px-1">
                  <Text className="text-white text-[9px] font-bold">{unreadNotices}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Pinned notice banner */}
          {visiblePinned && (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex-row items-start">
              <View className="bg-amber-500 rounded-full w-8 h-8 items-center justify-center mr-3 mt-0.5">
                <Ionicons name="megaphone" size={16} color="#FFFFFF" />
              </View>
              <TouchableOpacity
                onPress={() => router.push('/notices' as any)}
                className="flex-1"
                accessibilityRole="button"
                accessibilityLabel={`Pinned notice: ${visiblePinned.title}`}
              >
                <Text className="text-amber-900 font-semibold text-sm" numberOfLines={1}>
                  {visiblePinned.title}
                </Text>
                <Text className="text-amber-800 text-xs mt-0.5" numberOfLines={2}>
                  {visiblePinned.body}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dismissPinned(visiblePinned.id)}
                hitSlop={8}
                className="ml-2 p-1"
                accessibilityRole="button"
                accessibilityLabel="Dismiss pinned notice"
              >
                <Ionicons name="close" size={18} color="#92400E" />
              </TouchableOpacity>
            </View>
          )}

          {/* SOS Button */}
          <TouchableOpacity
            className="bg-red-600 rounded-2xl py-4 flex-row items-center justify-center gap-3"
            onPress={() => router.push('/medical/sos')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Emergency SOS - call for immediate help"
          >
            <Ionicons name="warning" size={24} color="#FFFFFF" />
            <View>
              <Text className="text-white font-bold text-base">Emergency SOS</Text>
              <Text className="text-red-100 text-xs">Tap to alert security & medical</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Emergency contacts grid */}
        {emergencyContacts.length > 0 && (
          <View className="px-6 mb-6">
            <Text className="text-xl font-semibold text-gray-900 mb-4">Emergency Contacts</Text>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {emergencyContacts.map((c, idx) => {
                const meta = DEFAULT_CONTACT_META[c.label] ?? {
                  icon: 'call' as IoniconName,
                  tint: '#0EA5E9',
                };
                const icon = c.icon ?? meta.icon;
                const tint = c.tint ?? meta.tint;
                return (
                  <View key={c.id ?? `${c.label}-${idx}`} style={{ width: '50%', padding: 6 }}>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${c.phone}`)}
                      className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center"
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${c.label} at ${c.phone}`}
                    >
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: `${tint}1A` }}
                      >
                        <Ionicons name={icon} size={20} color={tint} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900">{c.label}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                          {c.phone}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={{ width: '30%' }}
                className="min-h-[96px] bg-gray-50 border border-gray-200 rounded-2xl p-3 items-center justify-center"
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center mb-2"
                  style={{ backgroundColor: `${action.tint}1A` }}
                >
                  <Ionicons name={action.icon} size={22} color={action.tint} />
                </View>
                <Text className="text-xs font-semibold text-gray-700 text-center">{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Requests */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-semibold text-gray-900">Recent Requests</Text>
            <TouchableOpacity
              onPress={() => router.push('/services' as any)}
              accessibilityRole="button"
              accessibilityLabel="See all service requests"
            >
              <Text className="text-primary-500 text-sm font-semibold">See all</Text>
            </TouchableOpacity>
          </View>

          {!recentRequests?.length ? (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
              <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
              <Text className="text-gray-500 text-sm mt-2">No pending requests</Text>
            </View>
          ) : (
            recentRequests.slice(0, 3).map((req: ServiceRequestSummary) => (
              <TouchableOpacity
                key={req.id}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-3 justify-center"
                onPress={() => router.push(`/services/${req.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`Service request: ${req.category}, status ${req.status}`}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 capitalize">{req.category}</Text>
                    <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                      {req.description}
                    </Text>
                  </View>
                  <StatusBadge status={req.status} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    ASSIGNED: { bg: 'bg-primary-100', text: 'text-primary-700', label: 'Assigned' },
    IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'In Progress' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  };
  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return (
    <View className={`rounded-full px-2.5 py-1 ${c.bg}`}>
      <Text className={`text-xs font-medium ${c.text}`}>{c.label}</Text>
    </View>
  );
}
