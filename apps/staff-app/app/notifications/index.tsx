import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SectionList,
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
import { useTranslation } from 'react-i18next';
import { api } from '../../src/lib/api';
import { SkeletonCard } from '../../src/components/ui/Skeleton';

const BRAND = '#821A52'; // berry primary-500 (was legacy navy)
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
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`;
  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Category visuals — leading tinted icon circle keyed off the backend's
// category registry (notification-categories.ts). Legacy event names from
// older payloads normalise onto the same visuals.
// ---------------------------------------------------------------------------

type CategoryVisual = { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string };

const DEFAULT_VISUAL: CategoryVisual = { icon: 'notifications', tint: BRAND, bg: '#EFF4FB' };

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  visitor_approvals: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  visitors_gate: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  staff_tasks: { icon: 'checkbox', tint: '#2563EB', bg: '#DBEAFE' },
  staff_help_requests: { icon: 'hand-left', tint: '#7C3AED', bg: '#EDE9FE' },
  deliveries: { icon: 'cube', tint: '#0284C7', bg: '#E0F2FE' },
  notices: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  notices_urgent: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  payments: { icon: 'card', tint: '#1F7A45', bg: '#E7F4EC' },
  emergency_sos: { icon: 'alert', tint: '#C42847', bg: '#FCE9EE' },
  complaints: { icon: 'chatbubble', tint: '#7C3AED', bg: '#EDE9FE' },
  approval_results: { icon: 'checkmark-circle', tint: '#1F7A45', bg: '#E7F4EC' },
  account_auth: { icon: 'shield-checkmark', tint: '#475569', bg: '#F1F5F9' },
};

const LEGACY_TO_CATEGORY: Record<string, string> = {
  VISITOR_APPROVAL_REQUEST: 'visitor_approvals',
  VISITOR_ARRIVAL: 'visitor_approvals',
  TASK_ASSIGNED: 'staff_tasks',
  task: 'staff_tasks',
  HELP_REQUEST: 'staff_help_requests',
  help: 'staff_help_requests',
  NOTICE_PUBLISHED: 'notices',
  notice: 'notices',
  SOS_TRIGGERED: 'emergency_sos',
  sos: 'emergency_sos',
};

function visualFor(item: InboxItem): CategoryVisual {
  const key = item.type ?? '';
  return CATEGORY_VISUALS[key] ?? CATEGORY_VISUALS[LEGACY_TO_CATEGORY[key] ?? ''] ?? DEFAULT_VISUAL;
}

function deepLinkFor(item: InboxItem): string {
  const data = item.data ?? {};
  const id =
    (typeof data.entityId === 'string' && data.entityId) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof data.visitId === 'string' && data.visitId) ||
    undefined;
  switch (item.type) {
    // ── Category registry keys — the backend always sets these now ─────────
    case 'visitor_approvals':
    case 'visitors_gate':
    case 'deliveries':
    case 'approval_results':
      return '/visitors';
    case 'staff_tasks':
      return id ? `/tasks/${id}` : '/(tabs)/tasks';
    case 'staff_help_requests':
      return id ? `/help-requests/${id}` : '/help-requests';
    case 'notices':
    case 'notices_urgent':
    case 'community':
      return '/community/notices';
    case 'emergency_sos':
      return id ? `/help-requests/${id}` : '/help-requests';
    // ── Legacy aliases — rows written by older backend builds ──────────────
    case 'VISITOR_APPROVAL_REQUEST':
      return '/visitors';
    case 'TASK_ASSIGNED':
    case 'task':
      return id ? `/tasks/${id}` : '/(tabs)/tasks';
    case 'HELP_REQUEST':
    case 'help':
      return id ? `/help-requests/${id}` : '/help-requests';
    case 'NOTICE_PUBLISHED':
    case 'notice':
      return '/community/notices';
    case 'SOS_TRIGGERED':
    case 'sos':
      return '/help-requests';
    default:
      return '/notifications';
  }
}

// ---------------------------------------------------------------------------
// Date sections — Today / Yesterday / This week / Earlier
// ---------------------------------------------------------------------------

const SECTION_ORDER = ['today', 'yesterday', 'thisWeek', 'earlier'] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

function sectionKeyFor(iso: string): SectionKey {
  const t = new Date(iso).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfToday - 86_400_000) return 'yesterday';
  if (t >= startOfToday - 6 * 86_400_000) return 'thisWeek';
  return 'earlier';
}

type InboxSection = { key: SectionKey; data: InboxItem[] };

function buildSections(items: InboxItem[]): InboxSection[] {
  const buckets = new Map<SectionKey, InboxItem[]>();
  for (const item of items) {
    const key = sectionKeyFor(item.createdAt);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return SECTION_ORDER.filter((k) => buckets.has(k)).map((k) => ({ key: k, data: buckets.get(k)! }));
}

export default function StaffNotificationsInbox() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const sectionLabels: Record<SectionKey, string> = {
    today: t('notifications.inbox.today', 'Today'),
    yesterday: t('notifications.inbox.yesterday', 'Yesterday'),
    thisWeek: t('notifications.inbox.thisWeek', 'This week'),
    earlier: t('notifications.inbox.earlier', 'Earlier'),
  };

  // Clear the OS app-icon badge when the inbox gains focus — the badge is the
  // backend's unread NotificationLog count; opening the inbox acknowledges it.
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

  // Optimistic per-item mark-read: write the cache immediately, roll back on
  // error, and reconcile the unread badge count afterwards.
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

  const filters: { key: 'all' | 'unread'; label: string }[] = [
    { key: 'all', label: t('notifications.inbox.filterAll', 'All') },
    { key: 'unread', label: t('notifications.inbox.filterUnread', 'Unread') },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        >
          <Ionicons name="chevron-back" size={20} color={BRAND} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 dark:text-gray-50">
          {t('notifications.inbox.title', 'Notifications')}
        </Text>
        <TouchableOpacity
          onPress={() => markAllRead.mutate()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.inbox.markAllRead', 'Mark all read')}
        >
          <Text className="text-sm font-semibold" style={{ color: BRAND }}>
            {t('notifications.inbox.markAllRead', 'Mark all read')}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-2 px-4 pb-3">
        {filters.map((f) => {
          const active = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={
                active
                  ? 'rounded-full px-5 py-2'
                  : 'rounded-full px-5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
              }
              style={active ? { backgroundColor: BRAND } : undefined}
            >
              <Text
                className={
                  active
                    ? 'text-sm font-semibold text-white'
                    : 'text-sm font-semibold text-gray-700 dark:text-gray-200'
                }
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View className="gap-3 px-4 pt-1">
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-4 text-center text-base text-gray-700 dark:text-gray-200">
            {t('common.errorLoading', 'Could not load.')}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="rounded-xl px-5 py-3"
            style={{ backgroundColor: BRAND }}
          >
            <Text className="text-base font-semibold text-white">
              {t('common.tryAgain', 'Try again')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={
            sections.length === 0
              ? { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }
              : { paddingBottom: 24 }
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={BRAND} />
          }
          ListEmptyComponent={
            <View className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-success-soft">
                <Ionicons name="checkmark-done" size={28} color="#1F7A45" />
              </View>
              <Text className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-50">
                {t('notifications.inbox.emptyTitle', "You're all caught up")}
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                {filter === 'unread'
                  ? t('notifications.inbox.emptyUnread', 'No unread notifications right now.')
                  : t('notifications.inbox.emptyBody', 'New alerts will appear here.')}
              </Text>
            </View>
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={BRAND} style={{ paddingVertical: 14 }} /> : null
          }
          renderSectionHeader={({ section }) => (
            <Text className="px-5 pb-2 pt-4 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {sectionLabels[section.key]}
            </Text>
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
                className="mx-4 mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"
                style={unread ? { backgroundColor: '#EFF4FB', borderColor: 'rgba(30,58,95,0.18)' } : undefined}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body}. ${timeAgo(item.createdAt)}.`}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="h-11 w-11 rounded-full bg-gray-200" />
                ) : (
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: visual.bg }}
                  >
                    <Ionicons name={visual.icon} size={20} color={visual.tint} />
                  </View>
                )}
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    {unread ? (
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND }} />
                    ) : null}
                    <Text
                      className={
                        unread
                          ? 'flex-1 text-[15px] font-bold text-gray-900'
                          : 'flex-1 text-[15px] font-bold text-gray-900 dark:text-gray-50'
                      }
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-400">{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text
                    className={
                      unread
                        ? 'mt-0.5 text-sm leading-5 text-gray-600'
                        : 'mt-0.5 text-sm leading-5 text-gray-600 dark:text-gray-300'
                    }
                    numberOfLines={2}
                  >
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
