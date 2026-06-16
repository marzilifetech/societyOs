import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

/**
 * Global persistent strip rendered above every screen when the OS has
 * actively denied notifications. Tap → OS Settings (staff users are
 * trained recruits; we don't need the elaborate multi-step troubleshoot
 * page the resident app ships).
 *
 * Mount once in app/_layout.tsx beneath InAppBanner so a foreground push
 * still overlays this strip when one arrives.
 */
export function NotificationPermissionBanner() {
  const { status } = useNotificationPermission();
  if (status !== 'denied') return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <Pressable
        onPress={() => Linking.openSettings().catch(() => {})}
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
