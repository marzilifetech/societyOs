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
import { useNotificationBanner, BannerNotification } from '../contexts/NotificationContext';
import { api } from '../lib/api';

const BRAND = '#821A52';

/**
 * Foreground rich-notification banner. Sits above all routes — so a visitor
 * approval can pop over any screen the resident is on. Large fonts + high
 * contrast + 64px round photo, NoBrokerHood-grade for elderly users.
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
    if (current.type === 'VISITOR_APPROVAL_REQUEST' && current.entityId) {
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    // Android elevation
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
  btnApprove: { backgroundColor: BRAND },
  btnApproveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnReject: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#DC2626' },
  btnRejectText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
});
