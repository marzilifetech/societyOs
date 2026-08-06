import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

type Visitor = {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  type?: 'GUEST' | 'DELIVERY';
  deliveryPartner?: string | null;
  approvalStatus?: string | null;
  createdAt: string;
};

type Decision = 'APPROVE' | 'REJECT' | 'LEAVE_AT_SECURITY';

/**
 * Persistent in-app approval CARD that surfaces PENDING gate approvals across
 * every screen. Photo + name + inline Approve / Reject buttons so the resident
 * can decide without leaving what they were doing. Compared to a slim pill,
 * this is intentionally LARGER (NoBrokerHood-style) so action targets are
 * unmissable and the photo is recognisable at a glance.
 *
 * Auto-hides when count reaches 0; pulses on count increase so a fresh
 * arrival catches the eye even if push was missed. Positioned just below the
 * safe-area inset so it never blocks navigation. pointerEvents='box-none' on
 * the wrapper so taps outside the card pass through.
 *
 * Multiple pending → the most recent renders as the big card; a small
 * "+N more" pip is overlaid. Tap card body → review screen for that one;
 * tap "+N more" → /(tabs)/visitors with everything sorted pending-first.
 */
export function PendingVisitorsPill() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const pulse = useRef(new Animated.Value(0)).current;
  const lastCount = useRef(0);
  const [busy, setBusy] = useState<Decision | null>(null);

  const { data: visitors = [] } = useQuery<Visitor[]>({
    queryKey: ['my-visitors'],
    queryFn: () => api.get<Visitor[]>('/visitors/my'),
    enabled: !!token,
    refetchInterval: 20_000,
    staleTime: 0,
  });

  const pending = visitors.filter((v) => v.approvalStatus === 'PENDING');
  const count = pending.length;
  const top = pending[0];
  const isDelivery = top?.type === 'DELIVERY';

  const decide = useMutation({
    mutationFn: async (action: Decision) => {
      if (!top) return null;
      await api.post(`/visitors/${top.id}/decision`, { action });
    },
    onMutate: async (action) => {
      setBusy(action);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    onSettled: () => {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ['my-visitors'] });
    },
  });

  useEffect(() => {
    if (count > lastCount.current) {
      pulse.setValue(0);
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
    lastCount.current = count;
  }, [count, pulse]);

  if (count === 0 || !top) return null;

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const openReview = () => router.push(`/visitor/review/${top.id}` as any);
  const openHistory = () => router.push('/(tabs)/visitors' as any);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 56 }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={styles.card}>
          {/* Header strip with type chip + more-count */}
          <View style={styles.headerStrip}>
            <View style={[styles.typeChip, { backgroundColor: isDelivery ? '#FEF3C7' : '#DBEAFE' }]}>
              <Ionicons
                name={isDelivery ? 'cube' : 'person'}
                size={12}
                color={isDelivery ? '#92400E' : '#1E40AF'}
              />
              <Text
                style={[styles.typeChipText, { color: isDelivery ? '#92400E' : '#1E40AF' }]}
                numberOfLines={1}
              >
                {isDelivery
                  ? top.deliveryPartner
                    ? top.deliveryPartner.toUpperCase()
                    : 'DELIVERY'
                  : 'GUEST AT GATE'}
              </Text>
            </View>
            {count > 1 ? (
              <Pressable onPress={openHistory} hitSlop={10}>
                <View style={styles.morePip}>
                  <Text style={styles.morePipText}>+{count - 1} more</Text>
                </View>
              </Pressable>
            ) : null}
          </View>

          {/* Identity row */}
          <Pressable onPress={openReview} style={styles.identity}>
            {top.photoUrl ? (
              <Image source={{ uri: top.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Ionicons
                  name={isDelivery ? 'cube' : 'person'}
                  size={28}
                  color="#9CA3AF"
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {top.name || (isDelivery ? 'Delivery agent' : 'Visitor')}
              </Text>
              {top.phone ? (
                <Text style={styles.phone} numberOfLines={1}>
                  {top.phone}
                </Text>
              ) : (
                <Text style={styles.phone}>Tap photo for full details</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Action buttons — stacked vertically, full-width. Stacking
              guarantees both labels fit on the narrowest phones and gives a
              ≥56px tap target per industry-standard accessibility minimums.
              Order matches typical reading: APPROVE first (most common, top),
              then Leave (deliveries only), then REJECT (destructive, bottom). */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => decide.mutate('APPROVE')}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Approve visitor"
              style={({ pressed }) => [
                styles.actionBtn,
                styles.approveBtn,
                pressed && { opacity: 0.88 },
                busy === 'APPROVE' && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.approveText}>
                {isDelivery ? 'Approve & let them up' : 'Approve entry'}
              </Text>
            </Pressable>
            {isDelivery ? (
              <Pressable
                onPress={() => decide.mutate('LEAVE_AT_SECURITY')}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Leave at security"
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.leaveBtn,
                  pressed && { opacity: 0.88 },
                  busy === 'LEAVE_AT_SECURITY' && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="arrow-down-circle" size={20} color="#FFFFFF" />
                <Text style={styles.leaveText}>Leave at security</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => decide.mutate('REJECT')}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Reject visitor"
              style={({ pressed }) => [
                styles.actionBtn,
                styles.rejectBtn,
                pressed && { opacity: 0.88 },
                busy === 'REJECT' && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const APPROVE_GREEN = '#16A34A';
const LEAVE_AMBER = '#D97706';
const REJECT_RED = '#B91C1C';

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '70%',
  },
  typeChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  morePip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  morePipText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  phone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  actions: { gap: 10 },
  actionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  approveBtn: {
    backgroundColor: APPROVE_GREEN,
    shadowColor: APPROVE_GREEN,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  approveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  leaveBtn: { backgroundColor: LEAVE_AMBER },
  leaveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // Reject is a filled destructive button (matches Approve weight) — outlined
  // earlier looked optional next to the green CTA. Filled red is the
  // industry-standard for destructive primary action.
  rejectBtn: {
    backgroundColor: REJECT_RED,
    shadowColor: REJECT_RED,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  rejectText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
