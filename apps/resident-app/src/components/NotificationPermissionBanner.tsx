import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

/**
 * Persistent strip shown when the OS has actively denied notifications.
 * Tap → notification-troubleshoot page.
 *
 * IN-FLOW (not absolute): mounted at the top of the RootShell column ABOVE
 * the navigator, exactly like NetworkBanner, so it PUSHES the screen down
 * instead of floating over and covering each screen's header. (The previous
 * `position:absolute; top:0` overlaid the header — the bug this fixes.)
 *
 * No SafeAreaView here — mirrors NetworkBanner. Individual screens own their
 * top inset, and nesting another SafeAreaView above them would double-count
 * the status-bar padding and leave an ugly gap while this strip is visible.
 *
 * The visibility check polls on AppState change via the underlying hook, so
 * the banner auto-disappears the moment the user flips the OS toggle back on.
 * A foreground push (InAppBanner, absolute zIndex 9999) still overlays this.
 *
 * Senior-grade: 44+px hit target, 14pt body, plain language ("turned off"
 * beats "permission denied"), amber icon as the urgency anchor.
 */
export function NotificationPermissionBanner() {
  const { status } = useNotificationPermission();

  // Render only on a DEFINITIVE denied state — skip 'unknown' (first paint)
  // and 'undetermined' (never been asked) so we don't pre-emptively scare
  // a new user before the primer modal has had its turn.
  if (status !== 'denied') return null;

  return (
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
  );
}

const styles = StyleSheet.create({
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
