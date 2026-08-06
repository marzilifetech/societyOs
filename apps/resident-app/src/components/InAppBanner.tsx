import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationBanner, BannerNotification, classifyBannerType, type BannerType } from '../contexts/NotificationContext';
import { api } from '../lib/api';

const SUCCESS_INK = '#1F7A45';
const DANGER = '#DC2626';

/**
 * Per-category visual: leading tinted icon circle + top accent bar. Keyed off
 * the backend category registry (`data.type`), with legacy event names
 * normalised onto the same visuals. Unknown types fall back to the coarse
 * BannerType classifier so banner tint and auto-dismiss timing stay in
 * lockstep with one source of truth.
 */
type BannerVisual = { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string };

const CATEGORY_VISUALS: Record<string, BannerVisual> = {
  visitor_approvals: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  visitors_gate: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  deliveries: { icon: 'cube', tint: '#0284C7', bg: '#E0F2FE' },
  notices: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  notices_urgent: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  payments: { icon: 'card', tint: SUCCESS_INK, bg: '#E7F4EC' },
  payments_dues: { icon: 'card', tint: SUCCESS_INK, bg: '#E7F4EC' },
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

const FALLBACK_VISUALS: Record<BannerType, BannerVisual> = {
  MARKETING: { icon: 'megaphone', tint: '#16A34A', bg: '#DCFCE7' },
  DELIVERY: { icon: 'cube', tint: '#D97706', bg: '#FEF3C7' },
  EMERGENCY: { icon: 'warning', tint: DANGER, bg: '#FEE2E2' },
};

function visualFor(n: BannerNotification): BannerVisual {
  const key = n.type ?? '';
  return (
    CATEGORY_VISUALS[key] ??
    CATEGORY_VISUALS[LEGACY_TO_CATEGORY[key] ?? ''] ??
    FALLBACK_VISUALS[classifyBannerType(n)]
  );
}

/**
 * Foreground rich-notification banner. Sits above all routes — so a visitor
 * approval can pop over any screen the resident is on. Large fonts + high
 * contrast + tinted category icon circle, NoBrokerHood-grade for elderly users.
 *
 * Action buttons: rendered only when the payload carries `actionGroup`. The
 * APPROVE/REJECT taps call the visitor decision endpoint directly so the
 * resident doesn't need to navigate. All actions are idempotent server-side.
 */
export function InAppBanner() {
  const { current, dismiss } = useNotificationBanner();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;

  // Slide in on mount, slide out on dismiss.
  useEffect(() => {
    if (current) {
      translateY.setValue(-200);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }).start();
    }
  }, [current, translateY]);

  // Swipe up to dismiss.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -8,
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -50) {
          Animated.timing(translateY, {
            toValue: -200,
            duration: 180,
            useNativeDriver: true,
          }).start(() => dismiss());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!current) return null;

  const handleTap = () => {
    dismiss();
    routeFromBanner(current);
  };

  const handleAction = async (actionId: 'APPROVE' | 'REJECT') => {
    dismiss();
    // actionGroup is the canonical trigger; older payloads only carried the
    // legacy type, so keep it as a fallback.
    const isVisitorApproval =
      current.actionGroup === 'visitor_approval' || current.type === 'VISITOR_APPROVAL_REQUEST';
    if (isVisitorApproval && current.entityId) {
      try {
        await api.post(`/visitors/${current.entityId}/decision`, {
          action: actionId === 'APPROVE' ? 'APPROVE' : 'REJECT',
        });
      } catch {
        /* server is the source of truth; best-effort from banner */
      }
    }
  };

  const hasActions = current.actionGroup === 'visitor_approval';
  const visual = visualFor(current);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 4,
          transform: [{ translateY }],
        },
      ]}
      {...pan.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleTap}
        accessibilityRole="alert"
        accessibilityLabel={`${current.title}. ${current.body}`}
        style={styles.card}
      >
        <View style={[styles.accentBar, { backgroundColor: visual.tint }]} />
        <View style={styles.row}>
          {current.imageUrl ? (
            <Image source={{ uri: current.imageUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: visual.bg }]}>
              <Ionicons name={visual.icon} size={24} color={visual.tint} />
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.text} numberOfLines={2}>
              {current.body}
            </Text>
          </View>
        </View>

        {hasActions ? (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleAction('REJECT')}
              accessibilityRole="button"
              accessibilityLabel="Reject visitor"
              style={[styles.btn, styles.btnReject]}
            >
              <Text style={styles.btnRejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAction('APPROVE')}
              accessibilityRole="button"
              accessibilityLabel="Approve visitor"
              style={[styles.btn, styles.btnApprove]}
            >
              <Text style={styles.btnApproveText}>Approve</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

function routeFromBanner(n: BannerNotification) {
  switch (n.type) {
    // ── Category registry keys — the backend always sets these now ─────────
    case 'visitor_approvals':
    case 'visitors_gate':
      if (n.entityId) router.push(`/visitor/review/${n.entityId}` as any);
      return;
    case 'deliveries':
      if (n.entityId) router.push(`/visitor/review/${n.entityId}` as any);
      else router.push('/packages' as any);
      return;
    case 'complaints':
      if (n.entityId) router.push(`/complaints/${n.entityId}` as any);
      return;
    case 'notices':
    case 'notices_urgent':
    case 'community':
      router.push('/(tabs)/notices' as any);
      return;
    case 'emergency_sos':
      router.push('/medical/sos' as any);
      return;
    // ── Legacy aliases — payloads from older backend builds ────────────────
    case 'VISITOR_APPROVAL_REQUEST':
    case 'VISITOR_ARRIVAL':
      if (n.entityId) router.push(`/visitor/review/${n.entityId}` as any);
      return;
    case 'COMPLAINT_UPDATED':
      if (n.entityId) router.push(`/complaints/${n.entityId}` as any);
      return;
    case 'PACKAGE_ARRIVED':
      router.push('/packages' as any);
      return;
    case 'NOTICE_PUBLISHED':
      router.push('/(tabs)/notices' as any);
      return;
    case 'SOS_TRIGGERED':
    case 'SOS':
      router.push('/medical/sos' as any);
      return;
    default:
      router.push('/notifications' as any);
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    // Android elevation
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E5E7EB' },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#141414', marginBottom: 2 },
  text: { fontSize: 15, color: '#4B5563', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApprove: { backgroundColor: SUCCESS_INK },
  btnApproveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnReject: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: DANGER },
  btnRejectText: { color: DANGER, fontSize: 16, fontWeight: '700' },
});
