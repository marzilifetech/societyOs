import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

/**
 * Global persistent strip rendered above every screen when the OS has
 * actively denied notifications. Tap → notification-troubleshoot page.
 *
 * Mount once in app/_layout.tsx beneath InAppBanner (zIndex 8000 vs the
 * push banner's 9999) so a foreground push still overlays this strip when
 * one arrives. The visibility check polls on AppState change via the
 * underlying hook — so the banner auto-disappears the moment the user
 * flips the OS toggle back on without needing a manual refresh.
 *
 * Wrapped in SafeAreaView so notched devices push the strip below the
 * status bar / camera cutout cleanly.
 *
 * Senior-grade: 44+px hit target, 14pt body, plain language ("turned off"
 * beats "permission denied"), red icon as the urgency anchor.
 */
export function NotificationPermissionBanner() {
  const { status } = useNotificationPermission();

  // Render only on a DEFINITIVE denied state — skip 'unknown' (first paint)
  // and 'undetermined' (never been asked) so we don't pre-emptively scare
  // a new user before the primer modal has had its turn.
  if (status !== 'denied') return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push('/profile/notification-troubleshoot' as any)}
        accessibilityRole="button"
        accessibilityLabel="Notifications are turned off. Tap to fix."
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        hitSlop={4}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="notifications-off" size={16} color="#B45309" />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          Notifications are off — tap to fix
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#B45309" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8000,
    elevation: 16,
    backgroundColor: '#FEF3C7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
});
