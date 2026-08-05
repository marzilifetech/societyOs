import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { Display, IconCircle, SegmentedTabs } from '../../src/components/ui/redesign';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

const BRAND = '#821A52';
const INBOX_KEY = ['notifications', 'inbox'] as const;

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
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Category visuals — leading tinted icon circle per registry category key
// (backend/src/common/notification/notification-categories.ts). Legacy event
// names from older backend builds normalise onto the same visuals.
// ---------------------------------------------------------------------------

type CategoryVisual = { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string };

const DEFAULT_VISUAL: CategoryVisual = { icon: 'notifications', tint: BRAND, bg: '#FBEEF5' };

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  visitor_approvals: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  visitors_gate: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  staff_tasks: { icon: 'checkbox', tint: '#2563EB', bg: '#DBEAFE' },
  deliveries: { icon: 'cube', tint: '#0284C7', bg: '#E0F2FE' },
  notices: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  notices_urgent: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  payments: { icon: 'card', tint: '#1F7A45', bg: '#E7F4EC' },
  payments_dues: { icon: 'card', tint: '#1F7A45', bg: '#E7F4EC' },
  emergency_sos: { icon: 'alert', tint: '#C42847', bg: '#FCE9EE' },
  complaints: { icon: 'chatbubble', tint: '#7C3AED', bg: '#EDE9FE' },
  account_auth: { icon: 'shield-checkmark', tint: '#475569', bg: '#F1F5F9' },
};

const LEGACY_TO_CATEGORY: Record<string, string> = {
  VISITOR_APPROVAL_REQUEST: 'visitor_approvals',
  VISITOR_ARRIVAL: 'visitor_approvals',
  DELIVERY_APPROVAL_REQUEST: 'deliveries',
  PACKAGE_ARRIVED: 'deliveries',
  NOTICE_PUBLISHED: 'notices',
  COMPLAINT_UPDATED: 'complaints',
  SOS_TRIGGERED: 'emergency_sos',
  SOS: 'emergency_sos',
};

function visualFor(item: InboxItem): CategoryVisual {
  const key = item.type ?? '';
  return CATEGORY_VISUALS[key] ?? CATEGORY_VISUALS[LEGACY_TO_CATEGORY[key] ?? ''] ?? DEFAULT_VISUAL;
}

function deepLinkFor(item: InboxItem): string {
  const data = item.data ?? {};
  const entityId =
    (typeof data.entityId === 'string' && data.entityId) ||
    (typeof data.visitId === 'string' && data.visitId) ||
    undefined;
  switch (item.type) {
    // ── Category registry keys — the backend always sets these now ─────────
    case 'visitor_approvals':
    case 'visitors_gate':
      return entityId ? `/visitor/review/${entityId}` : '/notifications';
    case 'deliveries':
      return entityId ? `/visitor/review/${entityId}` : '/packages';
    case 'complaints':
      return entityId ? `/complaints/${entityId}` : '/complaints';
    case 'notices':
    case 'notices_urgent':
    case 'community':
      return '/(tabs)/notices';
    case 'emergency_sos':
      return '/medical/sos';
    // ── Legacy aliases — rows written by older backend builds ──────────────
    case 'VISITOR_APPROVAL_REQUEST':
    case 'VISITOR_ARRIVAL':
      return entityId ? `/visitor/review/${entityId}` : '/notifications';
    case 'DELIVERY_APPROVAL_REQUEST':
      return entityId ? `/visitor/review/${entityId}` : '/packages';
    case 'COMPLAINT_UPDATED':
      return entityId ? `/complaints/${entityId}` : '/complaints';
    case 'PACKAGE_ARRIVED':
      return '/packages';
    case 'NOTICE_PUBLISHED':
      return '/(tabs)/notices';
    case 'SOS_TRIGGERED':
    case 'SOS':
      return '/medical/sos';
    default:
      return '/notifications';
  }
}

// ---------------------------------------------------------------------------
// Date sections — Today / Yesterday / This week / Earlier
// ---------------------------------------------------------------------------

const SECTION_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'] as const;
type SectionTitle = (typeof SECTION_ORDER)[number];

function sectionTitleFor(iso: string): SectionTitle {
  const t = new Date(iso).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - 86_400_000) return 'Yesterday';
  if (t >= startOfToday - 6 * 86_400_000) return 'This week';
  return 'Earlier';
}

type InboxSection = { title: SectionTitle; data: InboxItem[] };

function buildSections(items: InboxItem[]): InboxSection[] {
  const buckets = new Map<SectionTitle, InboxItem[]>();
  for (const item of items) {
    const title = sectionTitleFor(item.createdAt);
    const list = buckets.get(title);
    if (list) list.push(item);
    else buckets.set(title, [item]);
  }
  return SECTION_ORDER.filter((t) => buckets.has(t)).map((t) => ({
    title: t,
    data: buckets.get(t)!,
  }));
}

const FILTERS: { key: 'all' | 'unread'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

export default function NotificationsInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Clear the OS app-icon badge whenever the inbox gains focus — the badge
  // mirrors the unread NotificationLog count the backend sends, and opening
  // the inbox is the "I've seen it" signal.
  useFocusEffect(
    useCallback(() => {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }, []),
  );

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
    queryKey: INBOX_KEY,
    queryFn: fetchPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // Optimistic per-item mark-read: flip readAt in the cache immediately so
  // the tint + dot clear without a network round-trip; roll back on error.
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: INBOX_KEY });
      const previous = qc.getQueryData<InfiniteData<InboxPage>>(INBOX_KEY);
      qc.setQueryData<InfiniteData<InboxPage>>(INBOX_KEY, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.map((it) =>
                  it.id === id && !it.readAt ? { ...it, readAt: new Date().toISOString() } : it,
                ),
              })),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(INBOX_KEY, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INBOX_KEY });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const sections = useMemo(
    () => buildSections(filter === 'unread' ? items.filter((it) => !it.readAt) : items),
    [items, filter],
  );

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

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#141414" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => markAllRead.mutate()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
        >
          <Text style={styles.headerAction}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.headerBlock}>
        <Display size="lg">Notifications</Display>
        <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} style={{ marginTop: 14 }} />
      </View>

      {isLoading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonPlaceholder count={3} height={78} borderRadius={16} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load notifications.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={BRAND} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <IconCircle icon="checkmark-done" size={64} bg="#E7F4EC" color="#1F7A45" />
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptySub}>
                {filter === 'unread'
                  ? 'No unread notifications right now.'
                  : 'New alerts will appear here.'}
              </Text>
            </View>
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={BRAND} style={{ paddingVertical: 14 }} /> : null
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const itemData = item.data ?? {};
            const imageUrl = typeof itemData.imageUrl === 'string' ? itemData.imageUrl : null;
            const visual = visualFor(item);
            const unread = !item.readAt;
            return (
              <TouchableOpacity
                onPress={() => handlePress(item)}
                activeOpacity={0.85}
                style={[styles.row, unread && styles.rowUnread]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body}. ${timeAgo(item.createdAt)}.`}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.avatar} />
                ) : (
                  <IconCircle icon={visual.icon} size={44} bg={visual.bg} color={visual.tint} />
                )}
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    {unread ? <View style={styles.dot} /> : null}
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.rowBodyText} numberOfLines={2}>
                    {item.body}
                  </Text>
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
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAction: { fontSize: 15, color: BRAND, fontWeight: '600' },
  headerBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: BRAND, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  listContent: { paddingBottom: 24 },
  emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyWrap: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#141414', marginTop: 10 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  rowUnread: { backgroundColor: '#FBEEF5', borderColor: 'rgba(130,26,82,0.16)' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB' },
  rowBody: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#141414', flex: 1 },
  rowTime: { fontSize: 12, color: '#9CA3AF' },
  rowBodyText: { fontSize: 14, color: '#4B5563', marginTop: 3, lineHeight: 19 },
});
