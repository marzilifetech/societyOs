import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { useRefreshOnFocus, usePullToRefresh } from '../../src/hooks/useRefreshOnFocus';
import { Display, IconCircle, rd } from '../../src/components/ui';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Soft card shadow matching the redesign-kit RoundCard surface.
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
} as const;

// Status chips follow the StatusPill soft-tone vocabulary.
const STATUS_CONFIG: Record<string, { bg: string; fg: string; icon: IoniconName; label: string }> = {
  EXPECTED: { bg: rd.amberSoft, fg: rd.amberInk, icon: 'time', label: 'Expected' },
  CHECKED_IN: { bg: rd.greenSoft, fg: '#1F7A45', icon: 'checkmark-circle', label: 'Checked In' },
  CHECKED_OUT: { bg: rd.inkSoft, fg: '#4B5563', icon: 'log-out', label: 'Checked Out' },
  DENIED: { bg: rd.crimsonSoft, fg: rd.crimson, icon: 'close-circle', label: 'Denied' },
};

export default function VisitorsTab() {
  const t = useTheme();
  const { data: visitors, isLoading, refetch } = useQuery({
    queryKey: ['my-visitors'],
    queryFn: () => api.get<any[]>('/visitors/my'),
  });
  useRefreshOnFocus(refetch);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  /**
   * Entries the gate has logged and that are waiting on this resident.
   *
   * They used to render as ordinary "Expected" rows buried in creation order,
   * with nothing indicating that a decision was needed — so a guard-logged
   * entry was effectively invisible here.
   */
  const sorted = [...(visitors ?? [])].sort((a, b) => {
    const aPending = a.approvalStatus === 'PENDING' ? 0 : 1;
    const bPending = b.approvalStatus === 'PENDING' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const pendingCount = sorted.filter((v) => v.approvalStatus === 'PENDING').length;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-3 flex-row justify-between items-center">
        <Display size="md">Visitors</Display>
        <TouchableOpacity
          className="bg-primary-500 rounded-full px-4 py-2 flex-row items-center gap-1"
          onPress={() => router.push('/visitor/new' as any)}
          accessibilityRole="button"
          accessibilityLabel="Invite a visitor"
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text className="text-white font-semibold text-sm">Invite</Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 && (
        <View className="mx-6 mb-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <Text className="text-sm font-semibold text-amber-900">
            {pendingCount} entry request{pendingCount > 1 ? 's' : ''} waiting for you
          </Text>
          <Text className="text-xs text-amber-700 mt-0.5">
            Someone is at the gate. Tap to approve or deny.
          </Text>
        </View>
      )}

      <FlatList
        data={sorted}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const awaiting = item.approvalStatus === 'PENDING';
          const c = awaiting
            ? { bg: rd.amberSoft, fg: rd.amberInk, icon: 'alert-circle' as IoniconName, label: 'Awaiting you' }
            : STATUS_CONFIG[item.status] ?? {
            bg: rd.inkSoft,
            fg: '#4B5563',
            icon: 'person' as IoniconName,
            label: item.status?.replace('_', ' ') ?? '',
          };
          return (
            <TouchableOpacity
              className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-3"
              style={cardShadow}
              onPress={() =>
                router.push(
                  (awaiting ? `/visitor/review/${item.id}` : `/visitor/${item.id}`) as any,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`View visitor pass for ${item.name}`}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                  {item.purpose && (
                    <Text className="text-sm text-gray-500 mt-0.5">{item.purpose}</Text>
                  )}
                  <Text className="text-xs text-gray-400 mt-1">
                    {new Date(item.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <View
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: c.bg }}
                >
                  <Ionicons name={c.icon} size={12} color={c.fg} />
                  <Text className="text-xs font-semibold" style={{ color: c.fg }}>{c.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center mt-20 px-8">
              <IconCircle icon="people-outline" size={64} bg={rd.crimsonSoft} color={t.accentPrimary} style={{ marginBottom: 16 }} />
              <Display size="sm" align="center" style={{ marginBottom: 6 }}>No visitors yet</Display>
              <Text className="text-gray-400 text-sm text-center">
                Invite a guest and we'll create a gate pass code they can show at the gate.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
