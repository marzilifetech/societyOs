import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
