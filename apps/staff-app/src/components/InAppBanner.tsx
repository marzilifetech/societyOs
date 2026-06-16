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
import { useNotificationBanner, BannerNotification, classifyBannerType, type BannerType } from '../contexts/NotificationContext';
import { api } from '../lib/api';

const BRAND = '#1E3A5F';
const DESTRUCTIVE = '#DC2626';

const TYPE_TINT: Record<BannerType, string> = {
  MARKETING: '#16A34A',
  DELIVERY: '#D97706',
  EMERGENCY: '#DC2626',
};

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
  const tint = TYPE_TINT[classifyBannerType(current)];

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
        style={[styles.card, { borderLeftWidth: 4, borderLeftColor: tint }]}
      >
        <View style={styles.row}>
          {current.imageUrl ? (
            <Image source={{ uri: current.imageUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoFallbackText}>!</Text>
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.text} numberOfLines={3}>
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
    case 'VISITOR_APPROVAL_REQUEST':
    case 'VISITOR_ARRIVAL':
    case 'approval_results':
      router.push('/visitors' as any);
      return;
    case 'TASK_ASSIGNED':
    case 'staff_tasks':
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
    case 'notices':
    case 'notices_urgent':
    case 'notice':
      router.push('/community/notices' as any);
      return;
    case 'SOS_TRIGGERED':
    case 'emergency_sos':
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E5E7EB' },
  photoFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  body: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#111111', marginBottom: 2 },
  text: { fontSize: 15, color: '#374151', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: BRAND },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: DESTRUCTIVE },
  btnSecondaryText: { color: DESTRUCTIVE, fontSize: 16, fontWeight: '700' },
});
