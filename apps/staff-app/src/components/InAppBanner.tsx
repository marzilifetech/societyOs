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
const DESTRUCTIVE = '#DC2626';

/**
 * Per-category visual: leading tinted icon circle + top accent bar. Keyed off
 * the backend category registry (`data.type`), with legacy event names
 * normalised onto the same visuals. Unknown types fall back to the coarse
 * BannerType classifier shared with the auto-dismiss timing.
 */
type BannerVisual = { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string };

const CATEGORY_VISUALS: Record<string, BannerVisual> = {
  visitor_approvals: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  visitors_gate: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  staff_tasks: { icon: 'checkbox', tint: '#2563EB', bg: '#DBEAFE' },
  staff_help_requests: { icon: 'hand-left', tint: '#7C3AED', bg: '#EDE9FE' },
  deliveries: { icon: 'cube', tint: '#0284C7', bg: '#E0F2FE' },
  notices: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  notices_urgent: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  payments: { icon: 'card', tint: SUCCESS_INK, bg: '#E7F4EC' },
  emergency_sos: { icon: 'alert', tint: '#C42847', bg: '#FCE9EE' },
  complaints: { icon: 'chatbubble', tint: '#7C3AED', bg: '#EDE9FE' },
  approval_results: { icon: 'checkmark-circle', tint: SUCCESS_INK, bg: '#E7F4EC' },
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

const FALLBACK_VISUALS: Record<BannerType, BannerVisual> = {
  MARKETING: { icon: 'megaphone', tint: '#16A34A', bg: '#DCFCE7' },
  DELIVERY: { icon: 'cube', tint: '#D97706', bg: '#FEF3C7' },
  EMERGENCY: { icon: 'warning', tint: DESTRUCTIVE, bg: '#FEE2E2' },
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
 * Foreground banner for staff push notifications. Overlays every screen so a
 * visitor / help-request approval never gets buried behind the current view.
 * Action buttons (Approve/Reject, Accept/Decline) call the backend directly
 * — same idempotent endpoints the lockscreen buttons hit.
 */
export function InAppBanner() {
  const { current, dismiss } = useNotificationBanner();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;

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

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -8,
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -50) {
          Animated.timing(translateY, { toValue: -200, duration: 180, useNativeDriver: true }).start(
            () => dismiss(),
          );
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

  const actionsForGroup = (group: string | undefined) => {
    switch (group) {
      case 'visitor_approval':
        return [
          { id: 'REJECT', label: 'Reject', destructive: true },
          { id: 'APPROVE', label: 'Approve', destructive: false },
        ];
      case 'help_request':
        return [
          { id: 'DECLINE', label: 'Decline', destructive: true },
          { id: 'ACCEPT', label: 'Accept', destructive: false },
        ];
      case 'task_assignment':
        return [
          { id: 'REJECT', label: 'Reject', destructive: true },
          { id: 'ACCEPT', label: 'Accept', destructive: false },
        ];
      default:
        return null;
    }
  };

  const actions = actionsForGroup(current.actionGroup);
  const visual = visualFor(current);

  const handleAction = async (actionId: string) => {
    dismiss();
    if (!current.entityId) return;
    try {
      if (current.actionGroup === 'visitor_approval') {
        await api.post(`/visitors/${current.entityId}/decision`, {
          action: actionId === 'APPROVE' ? 'APPROVE' : 'REJECT',
        });
      } else if (current.actionGroup === 'help_request') {
        if (actionId === 'ACCEPT') await api.patch(`/help-requests/${current.entityId}/accept`, {});
        else await api.patch(`/help-requests/${current.entityId}/decline`, {});
      } else if (current.actionGroup === 'task_assignment') {
        if (actionId === 'ACCEPT') await api.patch(`/tasks/${current.entityId}/accept`, {});
        else await api.patch(`/tasks/${current.entityId}/reject`, {});
      }
    } catch {
      /* server is the source of truth */
    }
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + 4, transform: [{ translateY }] }]}
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

        {actions ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => handleAction(a.id)}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={[
                  styles.btn,
                  a.destructive ? styles.btnSecondary : styles.btnPrimary,
                ]}
              >
                <Text style={a.destructive ? styles.btnSecondaryText : styles.btnPrimaryText}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

function routeFromBanner(n: BannerNotification) {
  const id = n.entityId ?? (n.data?.id as string | undefined) ?? (n.data?.visitId as string | undefined);
  switch (n.type) {
    // ── Category registry keys — the backend always sets these now ─────────
    case 'visitor_approvals':
    case 'visitors_gate':
    case 'deliveries':
    case 'approval_results':
      router.push('/visitors' as any);
      return;
    case 'staff_tasks':
      if (id) router.push(`/tasks/${id}` as any);
      else router.push('/(tabs)/tasks' as any);
      return;
    case 'staff_help_requests':
      if (id) router.push(`/help-requests/${id}` as any);
      else router.push('/help-requests' as any);
      return;
    case 'notices':
    case 'notices_urgent':
    case 'community':
      router.push('/community/notices' as any);
      return;
    case 'emergency_sos':
      if (id) router.push(`/help-requests/${id}` as any);
      else router.push('/help-requests' as any);
      return;
    // ── Legacy aliases — payloads from older backend builds ────────────────
    case 'VISITOR_APPROVAL_REQUEST':
    case 'VISITOR_ARRIVAL':
      router.push('/visitors' as any);
      return;
    case 'TASK_ASSIGNED':
    case 'task':
      if (id) router.push(`/tasks/${id}` as any);
      else router.push('/(tabs)/tasks' as any);
      return;
    case 'HELP_REQUEST':
    case 'help':
      if (id) router.push(`/help-requests/${id}` as any);
      else router.push('/help-requests' as any);
      return;
    case 'NOTICE_PUBLISHED':
    case 'notice':
      router.push('/community/notices' as any);
      return;
    case 'SOS_TRIGGERED':
    case 'sos':
      router.push('/help-requests' as any);
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
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
  btnPrimary: { backgroundColor: SUCCESS_INK },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: DESTRUCTIVE },
  btnSecondaryText: { color: DESTRUCTIVE, fontSize: 16, fontWeight: '700' },
});
