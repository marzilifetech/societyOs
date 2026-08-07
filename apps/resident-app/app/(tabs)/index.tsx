import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useTheme } from '../../src/hooks/useTheme';
import { api } from '../../src/lib/api';
import { Display, RoundCard, IconCircle, PillButton, StatusPill, rd, type RdStatusTone } from '../../src/components/ui';
import { HEALTH_ENABLED } from '../../src/lib/features';
import { openCarePortal } from '../../src/lib/care-portal';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ResidentProfile = { user?: { name?: string }; flat?: { block: string; number: string } };
type ServiceRequestSummary = {
  id: string;
  category: string;
  description: string;
  status: string;
  createdAt?: string;
  assignedStaff?: { name?: string } | null;
  assignee?: { name?: string } | null;
};
type Notice = { id: string; isRead: boolean };
type PinnedNotice = { id: string; title: string; body: string; isPinned: boolean };

const DISMISSED_PINNED_KEY = 'dismissed_pinned_notice_ids';

// 9 quick actions in the Figma 3×3 grid (node-id=22-1418 Home frame).
// `soon` marks a destination that currently renders the Coming Soon screen.
// Without the badge the grid promises twelve working features and quietly
// dead-ends on two of them, which reads as the app being broken rather than
// the feature being unreleased.
type QuickAction = {
  icon: IoniconName;
  label: string;
  route: string;
  bg: string;
  tint: string;
  soon?: boolean;
};
const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'people', label: 'Visitor', route: '/visitor/new', bg: '#FCEBD8', tint: '#B26B2E' },
  // Opens the web Care portal (doctors, appointments & more) already signed-in
  // via a one-time handoff — see openCarePortal(). Neutrally named on purpose.
  { icon: 'add-circle', label: 'PLUS', route: 'care-portal', bg: '#F3E8FF', tint: '#7C3AED' },
  // 'Medical' is gated by HEALTH_ENABLED (Play health-policy) — see src/lib/features.ts.
  ...(HEALTH_ENABLED
    ? [{ icon: 'medkit', label: 'Medical', route: '/medical', bg: '#FCE4E6', tint: '#DC2626' } as QuickAction]
    : []),
  { icon: 'restaurant', label: 'Canteen', route: '/canteen', bg: '#E5EDFB', tint: '#1D4ED8' },
  { icon: 'card', label: 'Payments', route: '/maintenance', bg: '#E5EDFB', tint: '#2563EB' },
  { icon: 'chatbubble-ellipses', label: 'Complaints', route: '/complaints', bg: '#FBF1D9', tint: '#B45309' },
  { icon: 'airplane', label: 'Travel', route: '/travel', bg: '#D9F2EA', tint: '#0F9D77', soon: true },
  { icon: 'home', label: 'Property', route: '/property', bg: '#FCE4EC', tint: '#C2185B', soon: true },
  { icon: 'help-circle', label: 'Concierge', route: '/help-requests', bg: '#E5EDFB', tint: '#2563EB' },
  { icon: 'construct', label: 'Services', route: '/(tabs)/services', bg: '#FDE7D3', tint: '#EA6E1B' },
  { icon: 'calendar', label: 'Events', route: '/(tabs)/events', bg: '#EDE7FB', tint: '#7C3AED' },
  { icon: 'megaphone', label: 'Notices', route: '/(tabs)/notices', bg: '#D9F0F5', tint: '#0E8DA8' },
  { icon: 'stats-chart', label: 'Polls', route: '/(tabs)/notices?tab=polls', bg: '#FBE7EF', tint: '#B0185C' },
];

const SR_STATUS: Record<string, { label: string; tone: RdStatusTone }> = {
  PENDING: { label: 'Under Review', tone: 'pending' },
  ASSIGNED: { label: 'Assigned', tone: 'pending' },
  IN_PROGRESS: { label: 'In Progress', tone: 'active' },
  ON_HOLD: { label: 'On Hold', tone: 'pending' },
};
const ACTIVE_STATUSES = Object.keys(SR_STATUS);

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen() {
  const t = useTheme();
  const qc = useQueryClient();
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
  // Lockscreen-style unread badge on the bell icon — counts NotificationLog rows
  // that haven't been read yet. Polls every 60s so the badge stays roughly fresh
  // without depending on websockets.
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
  const unreadInbox = unread?.count ?? 0;

  // Notification permission is no longer requested from Home. It is asked once
  // by NotificationOnboarding right after sign-in, using the OS dialog — see
  // that component for why the custom primer modal was dropped.

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

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.patch(`/service-requests/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-service-requests'] }),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchRequests()]);
    setRefreshing(false);
  };

  const firstName = profile?.user?.name?.split(' ')[0] ?? 'Resident';
  const flatNo = profile?.flat ? `${profile.flat.block} - ${profile.flat.number}` : '';
  const unreadNotices = notices?.filter((n) => !n.isRead).length ?? 0;
  const activeRequests = (recentRequests ?? []).filter((r) => ACTIVE_STATUSES.includes(r.status)).slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <LinearGradient
        colors={['#FCEAEF', '#FFF6F1', '#FFFFFF']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.accentPrimary} />}
        >
          {/* Greeting */}
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 8, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Display size="lg">
                  Hi, {firstName}{'  '}
                  <Text style={{ color: t.accentPrimary }}>✦</Text>
                </Display>
                {flatNo ? (
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/profile' as any)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                  >
                    <Text style={{ color: t.textSecondary, fontSize: t.fontSm }}>Flat {flatNo}</Text>
                    <Ionicons name="chevron-down" size={14} color={t.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => router.push('/notifications' as any)}
                accessibilityRole="button"
                accessibilityLabel={unreadInbox > 0 ? `Notifications, ${unreadInbox} unread` : 'Notifications'}
                style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
                  borderWidth: 1, borderColor: rd.cardBorder, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={22} color={t.textPrimary} />
                {unreadInbox > 0 && (
                  <View style={{
                    position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: rd.crimson, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>{unreadInbox > 99 ? '99+' : unreadInbox}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Pinned notice */}
          {visiblePinned && (
            <View style={{ paddingHorizontal: t.screenPadding, marginBottom: 16 }}>
              <RoundCard tone="white" style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <IconCircle icon="megaphone" size={36} bg={rd.amberSoft} color={rd.amberInk} style={{ marginRight: 12 }} />
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/notices' as any)}>
                  <Text numberOfLines={1} style={{ fontWeight: '700', color: t.textPrimary, fontSize: t.fontSm }}>{visiblePinned.title}</Text>
                  <Text numberOfLines={2} style={{ color: t.textMuted, fontSize: t.fontXs, marginTop: 2 }}>{visiblePinned.body}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dismissPinned(visiblePinned.id)} hitSlop={8} style={{ padding: 2 }}>
                  <Ionicons name="close" size={18} color={t.textMuted} />
                </TouchableOpacity>
              </RoundCard>
            </View>
          )}

          {/* Emergency SOS banner */}
          <View style={{ paddingHorizontal: t.screenPadding, marginBottom: 24 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/medical/sos')} accessibilityRole="button" accessibilityLabel="Emergency SOS - alert security and responders">
              <RoundCard tone="pink" padding={t.cardPaddingLg} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: rd.crimson, fontSize: t.fontLg, fontWeight: '800' }}>Emergency SOS</Text>
                  <Text style={{ color: t.textSecondary, fontSize: t.fontSm, marginTop: 3 }}>Tap to alert security & responders</Text>
                </View>
                <View style={{
                  width: 52, height: 52, borderRadius: 26, backgroundColor: rd.crimson,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: t.fontSm, letterSpacing: 1 }}>SOS</Text>
                </View>
              </RoundCard>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <View style={{ paddingHorizontal: t.screenPadding, marginBottom: 26 }}>
            <Display size="md" style={{ marginBottom: 16 }}>Quick Actions</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  onPress={() =>
                    a.route === 'care-portal' ? openCarePortal() : router.push(a.route as any)
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={a.soon ? `${a.label}, coming soon` : a.label}
                  style={{ width: '31%', alignItems: 'stretch' }}
                >
                  <RoundCard tone="white" padding={14} style={{ alignItems: 'center', minHeight: 108, justifyContent: 'center', opacity: a.soon ? 0.6 : 1 }}>
                    {a.soon ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          backgroundColor: rd.inkSoft,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: rd.radiusPill,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#6B7280' }}>SOON</Text>
                      </View>
                    ) : null}
                    <IconCircle icon={a.icon} size={48} bg={a.bg} color={a.tint} />
                    <Text style={{ marginTop: 10, fontSize: t.fontSm, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{a.label}</Text>
                  </RoundCard>
                </TouchableOpacity>
              ))}
              {/* Invisible spacers pad the final row to a multiple of 3 so that
                  `justifyContent: 'space-between'` left-aligns a partial last
                  row instead of stretching its items to the screen edges. The
                  action count changes with HEALTH_ENABLED, so this is computed. */}
              {Array.from({ length: (3 - (QUICK_ACTIONS.length % 3)) % 3 }).map((_, i) => (
                <View key={`qa-spacer-${i}`} style={{ width: '31%' }} />
              ))}
            </View>
          </View>

          {/* Active Requests */}
          <View style={{ paddingHorizontal: t.screenPadding }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Display size="md">Active Requests</Display>
              {activeRequests.length > 0 ? (
                <TouchableOpacity onPress={() => router.push('/(tabs)/services' as any)}>
                  <Text style={{ color: t.accentPrimary, fontSize: t.fontSm, fontWeight: '700' }}>See all</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {activeRequests.length === 0 ? (
              <RoundCard tone="white" style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Ionicons name="checkmark-circle" size={32} color={rd.green} />
                <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8 }}>No active requests</Text>
              </RoundCard>
            ) : (
              <View style={{ gap: 14 }}>
                {activeRequests.map((r) => {
                  const s = SR_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as RdStatusTone };
                  const who = r.assignedStaff?.name ?? r.assignee?.name;
                  const when = fmtWhen(r.createdAt);
                  return (
                    <RoundCard key={r.id} tone="white" padding={t.cardPaddingLg}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ flex: 1, fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, textTransform: 'capitalize', marginRight: 10 }}>
                          {r.category}
                        </Text>
                        <StatusPill label={s.label} tone={s.tone} />
                      </View>
                      {(when || who) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <Ionicons name="calendar-outline" size={14} color={t.textMuted} />
                          <Text style={{ fontSize: t.fontXs, color: t.textMuted }} numberOfLines={1}>
                            {[when, who].filter(Boolean).join('  •  ')}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={{ fontSize: t.fontSm, color: t.textSecondary, marginTop: 10 }} numberOfLines={2}>{r.description}</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                        <PillButton
                          label="Cancel"
                          tone="light"
                          size="md"
                          fullWidth={false}
                          textColor={rd.crimson}
                          onPress={() => cancelRequest.mutate(r.id)}
                          style={{ flex: 1 }}
                        />
                        <PillButton
                          label="Track Request"
                          tone="dark"
                          size="md"
                          fullWidth={false}
                          onPress={() => router.push(`/services/${r.id}` as any)}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </RoundCard>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
