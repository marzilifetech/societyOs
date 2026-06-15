import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../src/lib/api';

const BRAND = '#1E3A5F';

type InboxItem = {
  id: string;
  category: string;
  type?: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
};

type InboxPage = {
  items: InboxItem[];
  nextCursor: string | null;
};

const fetchPage = async ({ pageParam }: { pageParam?: string }): Promise<InboxPage> => {
  const qs = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
  return api.get<InboxPage>(`/notifications${qs}`);
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`;
  return new Date(iso).toLocaleDateString();
}

function deepLinkFor(item: InboxItem): string {
  const data = item.data ?? {};
  const id =
    (typeof data.entityId === 'string' && data.entityId) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof data.visitId === 'string' && data.visitId) ||
    undefined;
  switch (item.type) {
    case 'VISITOR_APPROVAL_REQUEST':
    case 'approval_results':
      return '/visitors';
    case 'TASK_ASSIGNED':
    case 'staff_tasks':
    case 'task':
      return id ? `/tasks/${id}` : '/(tabs)/tasks';
    case 'HELP_REQUEST':
    case 'help':
      return id ? `/help-requests/${id}` : '/help-requests';
    case 'NOTICE_PUBLISHED':
    case 'notices':
    case 'notices_urgent':
    case 'notice':
      return '/community/notices';
    case 'SOS_TRIGGERED':
    case 'emergency_sos':
    case 'sos':
      return '/help-requests';
    default:
      return '/notifications';
  }
}

export default function StaffNotificationsInbox() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: fetchPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const handlePress = useCallback(
    (item: InboxItem) => {
      if (!item.readAt) markRead.mutate(item.id);
      router.push(deepLinkFor(item) as any);
    },
    [markRead],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Text style={styles.headerBack}>‹ {t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.inbox.title', 'Notifications')}</Text>
        <TouchableOpacity
          onPress={() => markAllRead.mutate()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.inbox.markAllRead', 'Mark all read')}
        >
          <Text style={styles.headerAction}>
            {t('notifications.inbox.markAllRead', 'Mark all read')}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('common.errorLoading', 'Could not load.')}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.tryAgain', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={items.length === 0 ? styles.empty : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={BRAND} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {t('notifications.inbox.empty', "You're all caught up.")}
            </Text>
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={BRAND} style={{ paddingVertical: 14 }} /> : null
          }
          renderItem={({ item }) => {
            const data = item.data ?? {};
            const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : null;
            return (
              <TouchableOpacity
                onPress={() => handlePress(item)}
                style={[styles.row, item.readAt ? null : styles.rowUnread]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body}. ${timeAgo(item.createdAt)}.`}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Text style={styles.thumbFallbackText}>{item.title.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    {!item.readAt ? <View style={styles.dot} /> : null}
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.rowBodyText} numberOfLines={2}>
                    {item.body}
                  </Text>
                  <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerBack: { fontSize: 17, color: BRAND, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
  headerAction: { fontSize: 15, color: BRAND, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: BRAND, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#6B7280' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowUnread: { backgroundColor: '#EFF4FB' },
  thumb: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
  thumbFallback: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111111', flex: 1 },
  rowBodyText: { fontSize: 14, color: '#374151', marginTop: 2, lineHeight: 19 },
  rowTime: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
