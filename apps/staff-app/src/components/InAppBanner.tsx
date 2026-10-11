import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationBanner } from '../contexts/NotificationContext';
import { useLockStore } from '../store/lock.store';
import { appNavigator } from '../lib/navigation';
import {
  actionsForGroup,
  hrefForNotification,
  performNotificationAction,
  visualForNotification,
} from '../lib/notification-routes';

const SUCCESS_INK = '#1F7A45';
const DESTRUCTIVE = '#DC2626';

/**
 * Foreground banner for staff push notifications. Overlays every screen so a
 * task, visitor or SOS alert never gets buried behind the current view. While
 * signed in, the OS banner is suppressed in the foreground (see
 * setupNotificationHandler), so this IS the notification.
 *
 * Rendered in place, with no entrance animation. It used to spring in from
 * translateY -200; on this app (RN 0.81, old architecture, Android) an Animated
 * value never reaches a view that mounts after its screen's first render, so
 * the banner stayed off-screen and foreground pushes were simply invisible.
 * Proven on device in the resident app, which shares the setup.
 */
export function InAppBanner() {
  const { current, dismiss } = useNotificationBanner();
  /** Never above the PIN lock: its actions would act without the PIN. */
  const locked = useLockStore((s) => s.locked);
  const insets = useSafeAreaInsets();
  /** Which action is in flight, so its button can show progress. */
  const [acting, setActing] = useState<string | null>(null);
  /** Set when an action fails, so the banner says so instead of vanishing. */
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setActing(null);
    setActionError(null);
  }, [current]);

  // A banner already showing when the app locks waits underneath, and comes
  // back on unlock.
  if (!current || locked) return null;

  const handleTap = () => {
    dismiss();
    appNavigator.navigateWhenReady(hrefForNotification(current.type, current.data));
  };

  const actions = current.entityId ? actionsForGroup(current.actionGroup) : null;
  const visual = visualForNotification(current.type);

  /**
   * The banner is dismissed only AFTER the call succeeds, so a failure leaves
   * it on screen with an error instead of pretending the action landed.
   */
  const handleAction = async (actionId: string) => {
    if (!current.entityId || useLockStore.getState().locked) return;
    setActionError(null);
    setActing(actionId);
    try {
      await performNotificationAction(current.actionGroup, actionId, current.entityId);
      dismiss();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not save that. Tap to open.');
    } finally {
      setActing(null);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
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
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            style={styles.close}
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {actionError ? (
          <Text style={styles.actionError} accessibilityLiveRegion="polite">
            {actionError}
          </Text>
        ) : null}

        {actions ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => handleAction(a.id)}
                disabled={acting !== null}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityState={{ disabled: acting !== null, busy: acting === a.id }}
                style={[
                  styles.btn,
                  a.destructive ? styles.btnSecondary : styles.btnPrimary,
                  acting !== null && acting !== a.id ? styles.btnDimmed : null,
                ]}
              >
                <Text style={a.destructive ? styles.btnSecondaryText : styles.btnPrimaryText}>
                  {acting === a.id ? 'Saving…' : a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
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
  close: { padding: 4, alignSelf: 'flex-start' },
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
  btnDimmed: { opacity: 0.45 },
  actionError: {
    color: DESTRUCTIVE,
    fontSize: 13,
    marginTop: 8,
    marginHorizontal: 4,
  },
});
