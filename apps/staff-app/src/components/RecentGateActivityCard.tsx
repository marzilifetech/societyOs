import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { unwrapApiEnvelope } from '@societyos/api-client';
import { api } from '../lib/api';
import { RecentGateActivitySheet } from './RecentGateActivitySheet';

type Visitor = {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  type?: 'GUEST' | 'DELIVERY';
  deliveryPartner?: string | null;
  approvalStatus?: string | null;
  createdAt: string;
  entryAt?: string | null;
};

const LAST_SEEN_KEY = '@staff-app/recent-gate-activity-last-seen-v1';
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Compact card pinned near the top of the staff Home (security guards
 * only): latest visitor that came in + count of others in the last 24h.
 * Tap opens RecentGateActivitySheet — a bottom-sheet list of everyone.
 *
 * Mirrors resident-app's RecentEntriesCard styling so the two apps feel
 * unified. Auto-hides when there's nothing.
 */
export function RecentGateActivityCard() {
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then((raw) => {
      const n = raw ? Number(raw) : 0;
      if (Number.isFinite(n)) setLastSeenAt(n);
    });
  }, []);

  const { data: approved = [] } = useQuery<Visitor[]>({
    queryKey: ['staff-visitors-approved-recent'],
    queryFn: async () => {
      const raw = await api.get<object>('/staff/visitors?approvalStatus=APPROVED');
      return unwrapApiEnvelope<Visitor[]>(raw);
    },
    refetchInterval: 60_000,
  });
  const { data: leftAtSec = [] } = useQuery<Visitor[]>({
    queryKey: ['staff-visitors-left-at-security-recent'],
    queryFn: async () => {
      const raw = await api.get<object>('/staff/visitors?approvalStatus=LEFT_AT_SECURITY');
      return unwrapApiEnvelope<Visitor[]>(raw);
    },
    refetchInterval: 60_000,
  });

  const recent = useMemo(() => {
    const now = Date.now();
    return [...approved, ...leftAtSec]
      .filter((v) => {
        const ts = new Date(v.entryAt ?? v.createdAt).getTime();
        return now - ts <= LOOKBACK_MS;
      })
      .sort((a, b) => {
        const ta = new Date(a.entryAt ?? a.createdAt).getTime();
        const tb = new Date(b.entryAt ?? b.createdAt).getTime();
        return tb - ta;
      });
  }, [approved, leftAtSec]);

  const newCount = useMemo(
    () => recent.filter((v) => new Date(v.entryAt ?? v.createdAt).getTime() > lastSeenAt).length,
    [recent, lastSeenAt],
  );

  const handleOpen = useCallback(() => {
    const now = Date.now();
    AsyncStorage.setItem(LAST_SEEN_KEY, String(now)).catch(() => {});
    setLastSeenAt(now);
    setSheetOpen(true);
  }, []);

  if (recent.length === 0) return null;

  const latest = recent[0];
  const isDelivery = latest.type === 'DELIVERY';
  const extra = recent.length - 1;

  return (
    <>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Recent gate activity — ${recent.length} in last 24 hours${newCount ? `, ${newCount} new` : ''}, tap to view all`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.avatarWrap}>
          {latest.photoUrl ? (
            <Image source={{ uri: latest.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name={isDelivery ? 'cube' : 'person'} size={22} color="#9CA3AF" />
            </View>
          )}
          {extra > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>+{extra}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
          <View style={styles.labelRow}>
            <View style={styles.labelChip}>
              <Ionicons name="enter" size={11} color="#1E3A5F" />
              <Text style={styles.labelChipText}>RECENT GATE ACTIVITY</Text>
            </View>
            {newCount > 0 ? <View style={styles.redDot} /> : null}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {isDelivery
              ? `${latest.deliveryPartner ?? 'Delivery'} — ${latest.name}`
              : latest.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {formatEntryTime(latest.entryAt ?? latest.createdAt)}
            {extra > 0 ? ` • ${extra} more today` : ''}
          </Text>
        </View>

        <View style={styles.chevWrap}>
          <Ionicons name="chevron-up" size={18} color="#9CA3AF" />
        </View>
      </Pressable>

      <RecentGateActivitySheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        visitors={recent}
      />
    </>
  );
}

function formatEntryTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STAFF_PRIMARY = '#1E3A5F';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBE5F1',
    shadowColor: STAFF_PRIMARY,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  countBadge: {
    position: 'absolute', bottom: -2, right: -2,
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: STAFF_PRIMARY,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E0EAF7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  labelChipText: { fontSize: 10, fontWeight: '800', color: STAFF_PRIMARY, letterSpacing: 0.6 },
  redDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626', shadowOpacity: 0.55, shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  name: { fontSize: 16, fontWeight: '800', color: '#111827', letterSpacing: -0.2 },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chevWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
});
