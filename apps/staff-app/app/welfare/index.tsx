import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

type StaffNoticeCategory = 'WELFARE' | 'POLICY' | 'SAFETY' | 'SCHEDULE';

interface StaffNotice {
  id: string;
  title: string;
  body: string;
  category: StaffNoticeCategory;
  publishedAt: string | null;
  pinnedUntil: string | null;
  createdAt: string;
}

const CATEGORY_STYLES: Record<StaffNoticeCategory, { label: string; badge: string; text: string }> = {
  WELFARE: { label: 'Welfare', badge: 'bg-green-100', text: 'text-green-700' },
  POLICY: { label: 'Policy', badge: 'bg-primary-50', text: 'text-primary-500' },
  SAFETY: { label: 'Safety', badge: 'bg-red-100', text: 'text-red-700' },
  SCHEDULE: { label: 'Schedule', badge: 'bg-amber-100', text: 'text-amber-700' },
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WelfareScreen() {
  const { data, isLoading, isError, refetch } = useQuery<StaffNotice[]>({
    queryKey: ['staff-notices'],
    queryFn: () => api.get<StaffNotice[]>('/staff/notices'),
  });

  const notices = data ?? [];
  const pinned = notices.filter((n) => n.pinnedUntil && new Date(n.pinnedUntil) > new Date());
  const rest = notices.filter((n) => !n.pinnedUntil || new Date(n.pinnedUntil) <= new Date());

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View className="flex-1 ml-2">
          <Text className="text-gray-900 text-xl font-bold">Welfare & Notices</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Announcements from management</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#821A52" />
        </View>
      ) : isError ? (
        <ErrorCard message="Could not load notices. Please try again." onRetry={() => refetch()} />
      ) : notices.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="heart" size={32} color="#821A52" />
          </View>
          <Text className="text-gray-900 text-base font-semibold text-center">No notices yet</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">Management will post welfare updates and announcements here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {pinned.length > 0 && (
            <>
              <Text className="text-gray-500 text-xs font-semibold tracking-wider mb-2.5">PINNED</Text>
              {pinned.map((n) => <NoticeCard key={n.id} notice={n} pinned />)}
              {rest.length > 0 && (
                <Text className="text-gray-500 text-xs font-semibold tracking-wider mb-2.5 mt-2">ALL NOTICES</Text>
              )}
            </>
          )}
          {rest.map((n) => <NoticeCard key={n.id} notice={n} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NoticeCard({ notice, pinned }: { notice: StaffNotice; pinned?: boolean }) {
  const cat = CATEGORY_STYLES[notice.category] ?? CATEGORY_STYLES.POLICY;
  const dateStr = formatDate(notice.publishedAt ?? notice.createdAt);

  return (
    <View className={`bg-gray-50 rounded-2xl p-4 mb-3 border ${pinned ? 'border-primary-500' : 'border-gray-200'}`}>
      <View className="flex-row justify-between items-start mb-2">
        <View className={`rounded-lg px-2 py-0.5 ${cat.badge}`}>
          <Text className={`text-xs font-semibold ${cat.text}`}>{cat.label}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          {pinned && <Ionicons name="bookmark" size={14} color="#821A52" />}
          <Text className="text-gray-500 text-xs">{dateStr}</Text>
        </View>
      </View>
      <Text className="text-gray-900 text-base font-semibold mb-1.5">{notice.title}</Text>
      <Text className="text-gray-500 text-sm leading-5">{notice.body}</Text>
    </View>
  );
}
