import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Tappable } from '../../src/components/ui/Tappable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { openNotificationSettings } from '../../src/lib/push';
import { useNotificationPermission } from '../../src/hooks/useNotificationPermission';
import { Display, rd } from '../../src/components/ui/redesign';
import { SkeletonPlaceholder } from '../../src/components/common/SkeletonPlaceholder';

type Preference = {
  key: string;
  label: string;
  description: string;
  importance: string;
  mutable: boolean;
  enabled: boolean;
};

const PREFS_KEY = ['notification-preferences'] as const;

/**
 * Topic grouping. The backend returns a flat list of 11 categories ordered by
 * internal importance, which reads as an undifferentiated wall of switches.
 * Residents think in terms of *where the alert comes from* — the gate, their
 * money, the society — so we group on that instead. Any category the backend
 * adds later that isn't listed here still renders, under "Other".
 */
const GROUPS: { title: string; caption: string; keys: string[] }[] = [
  {
    title: 'At your gate',
    caption: 'Who is arriving and what needs your approval',
    keys: ['visitors_gate', 'deliveries', 'daily_help', 'family_vehicle'],
  },
  {
    title: 'Your home',
    caption: 'Requests you raised and money you owe',
    keys: ['complaints', 'payments_dues'],
  },
  {
    title: 'Society updates',
    caption: 'Notices and community activity',
    keys: ['notices', 'community'],
  },
];

export default function NotificationSettingsScreen() {
  const qc = useQueryClient();
  const { status: permission, refresh: refreshPermission } = useNotificationPermission();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<Preference[]>({
    queryKey: PREFS_KEY,
    queryFn: () => api.get<Preference[]>('/notifications/preferences'),
  });

  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedAt(null), 1800);
  }, []);

  /**
   * Toggles save immediately. The previous screen collected changes behind a
   * "Save preferences" button, so backing out — the natural gesture after
   * flipping a switch — silently discarded everything. Optimistic update keeps
   * the switch responsive; a failed request rolls it back and surfaces itself.
   */
  const save = useMutation<void, Error, { key: string; enabled: boolean }, { prev?: Preference[] }>({
    mutationFn: ({ key, enabled }) =>
      api.patch<void>('/notifications/preferences', {
        prefs: [{ category: key, enabled }],
      }),
    onMutate: async ({ key, enabled }) => {
      await qc.cancelQueries({ queryKey: PREFS_KEY });
      const prev = qc.getQueryData<Preference[]>(PREFS_KEY);
      qc.setQueryData<Preference[]>(PREFS_KEY, (old) =>
        old?.map((p) => (p.key === key ? { ...p, enabled } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(PREFS_KEY, ctx.prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    },
    onSuccess: () => flashSaved(),
    onSettled: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });

  const prefs = data ?? [];
  const byKey = useMemo(() => new Map(prefs.map((p) => [p.key, p])), [prefs]);

  const { groups, alwaysOn, other } = useMemo(() => {
    const claimed = new Set(GROUPS.flatMap((g) => g.keys));
    const groups = GROUPS.map((g) => ({
      ...g,
      items: g.keys.map((k) => byKey.get(k)).filter((p): p is Preference => !!p && p.mutable),
    })).filter((g) => g.items.length > 0);
    const alwaysOn = prefs.filter((p) => !p.mutable);
    const other = prefs.filter((p) => p.mutable && !claimed.has(p.key));
    return { groups, alwaysOn, other };
  }, [prefs, byKey]);

  const blocked = permission === 'denied' || permission === 'undetermined';

  const onToggle = (pref: Preference, next: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    save.mutate({ key: pref.key, enabled: next });
  };

  const enablePermission = async () => {
    await openNotificationSettings();
    // The hook re-checks on app foreground, but refresh explicitly so the
    // banner clears the moment the user swipes back into the app.
    refreshPermission();
  };

  const renderRow = (pref: Preference, isLast: boolean) => (
    <View key={pref.key} style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, blocked && styles.rowLabelMuted]}>{pref.label}</Text>
        {pref.description ? <Text style={styles.rowDesc}>{pref.description}</Text> : null}
      </View>
      <Switch
        value={pref.enabled}
        onValueChange={(v) => onToggle(pref, v)}
        disabled={blocked}
        trackColor={{ false: '#E5E7EB', true: '#821A52' }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E7EB"
        accessibilityLabel={pref.label}
        accessibilityHint={pref.description}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#141414" />
        </Pressable>
        {savedAt ? (
          <View style={styles.savedPill}>
            <Ionicons name="checkmark-circle" size={14} color={rd.green} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <Display size="lg">Notifications</Display>
          <Text style={styles.headerSub}>
            Changes save automatically. Urgent safety alerts can't be switched off.
          </Text>
        </View>

        {/* Permission gate — category toggles are meaningless while the OS
            blocks delivery, so say that plainly instead of letting the user
            flip switches that can't take effect. */}
        {blocked ? (
          <View style={styles.permCard}>
            <View style={styles.permIcon}>
              <Ionicons name="notifications-off" size={20} color="#B45309" />
            </View>
            <View style={styles.permBody}>
              <Text style={styles.permTitle}>Notifications are turned off</Text>
              <Text style={styles.permText}>
                {Platform.OS === 'android'
                  ? 'Android is blocking alerts from this app, so none of the settings below apply yet.'
                  : 'iOS is blocking alerts from this app, so none of the settings below apply yet.'}
              </Text>
              <Tappable
                onPress={enablePermission}
                style={styles.permBtn} pressedStyle={{ opacity: 0.85 }}
                accessibilityRole="button"
                accessibilityLabel="Open notification settings"
              >
                <Text style={styles.permBtnText}>Turn on notifications</Text>
              </Tappable>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.skeleton}>
            <SkeletonPlaceholder count={4} height={72} borderRadius={16} />
          </View>
        ) : isError ? (
          <View style={styles.errorWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color="#9CA3AF" />
            <Text style={styles.errorTitle}>Couldn't load your preferences</Text>
            <Text style={styles.errorSub}>Check your connection and try again.</Text>
            <Tappable
              onPress={() => refetch()}
              style={styles.retryBtn} pressedStyle={{ opacity: 0.85 }}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              {isRefetching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.retryText}>Try again</Text>
              )}
            </Tappable>
          </View>
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{g.title}</Text>
                <Text style={styles.sectionCaption}>{g.caption}</Text>
                <View style={styles.card}>
                  {g.items.map((p, i) => renderRow(p, i === g.items.length - 1))}
                </View>
              </View>
            ))}

            {other.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other</Text>
                <View style={styles.card}>
                  {other.map((p, i) => renderRow(p, i === other.length - 1))}
                </View>
              </View>
            )}

            {alwaysOn.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Always on</Text>
                <Text style={styles.sectionCaption}>
                  Safety and account alerts stay on so you never miss an emergency.
                </Text>
                <View style={styles.card}>
                  {alwaysOn.map((p, i) => (
                    <View
                      key={p.key}
                      style={[styles.row, i < alwaysOn.length - 1 && styles.rowDivider]}
                    >
                      <View style={styles.rowBody}>
                        <Text style={styles.rowLabel}>{p.label}</Text>
                        {p.description ? (
                          <Text style={styles.rowDesc}>{p.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.lockPill}>
                        <Ionicons name="lock-closed" size={11} color={rd.amberInk} />
                        <Text style={styles.lockText}>Always</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Escape hatches — the two things a user wants when alerts misbehave. */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Tappable
              onPress={() => router.push('/settings/notification-test' as any)}
              style={[styles.linkRow, styles.rowDivider]} pressedStyle={styles.pressed}
              accessibilityRole="button"
              accessibilityLabel="Send a test notification"
            >
              <Ionicons name="flask-outline" size={18} color="#821A52" />
              <Text style={styles.linkText}>Send a test notification</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Tappable>
            <Tappable
              onPress={() => router.push('/profile/notification-troubleshoot' as any)}
              style={[styles.linkRow, styles.rowDivider]} pressedStyle={styles.pressed}
              accessibilityRole="button"
              accessibilityLabel="Notifications not arriving"
            >
              <Ionicons name="medkit-outline" size={18} color="#821A52" />
              <Text style={styles.linkText}>Notifications not arriving?</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Tappable>
            <Tappable
              onPress={() => Linking.openSettings()}
              style={styles.linkRow} pressedStyle={styles.pressed}
              accessibilityRole="button"
              accessibilityLabel="Open system notification settings"
            >
              <Ionicons name="settings-outline" size={18} color="#821A52" />
              <Text style={styles.linkText}>System notification settings</Text>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </Tappable>
          </View>
        </View>
      </ScrollView>
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
    borderColor: rd.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: rd.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: rd.radiusPill,
  },
  savedText: { fontSize: 12, fontWeight: '700', color: rd.green },

  scroll: { paddingBottom: 48 },
  headerBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 6, lineHeight: 18 },

  permCard: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    backgroundColor: rd.amberSoft,
    borderRadius: rd.radiusCardLg,
  },
  permIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(180,83,9,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBody: { flex: 1 },
  permTitle: { fontSize: 15, fontWeight: '700', color: '#7C2D12' },
  permText: { fontSize: 13, color: '#92400E', marginTop: 4, lineHeight: 18 },
  permBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#B45309',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: rd.radiusPill,
  },
  permBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  skeleton: { paddingHorizontal: 16, paddingTop: 18 },
  errorWrap: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 6 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#141414', marginTop: 8 },
  errorSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#821A52',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: rd.radiusPill,
    minWidth: 120,
    alignItems: 'center',
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 22,
  },
  sectionCaption: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 22,
    paddingTop: 3,
    paddingBottom: 8,
    lineHeight: 16,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: rd.radiusCardLg,
    borderWidth: 1,
    borderColor: rd.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 68,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#141414' },
  rowLabelMuted: { color: '#9CA3AF' },
  rowDesc: { fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 17 },

  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: rd.amberSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: rd.radiusPill,
  },
  lockText: { fontSize: 11, fontWeight: '700', color: rd.amberInk },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 56,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#141414' },
  pressed: { backgroundColor: '#F4F4F6' },
});
