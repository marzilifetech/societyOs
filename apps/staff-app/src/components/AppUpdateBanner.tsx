import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tappable } from './ui/Tappable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * Slim dismissible banner shown when the staff app is below `recommended`
 * but above `min`. Mirrors apps/resident-app/src/components/AppUpdateBanner.tsx
 * — see that file for the dismissal rationale.
 */
export function AppUpdateBanner({ url, message }: { url: string; message: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const onTap = () => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <View style={styles.row}>
        <Tappable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel="A new version is available. Tap to update."
          style={styles.tap}
          pressedStyle={{ opacity: 0.85 }}
          hitSlop={4}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.text} numberOfLines={2}>
            {message ?? 'A newer version is ready. Tap to update.'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#1D4ED8" />
        </Tappable>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update notice for now"
          style={styles.close}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color="#475569" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8500,
    elevation: 18,
    backgroundColor: '#DBEAFE',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  tap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    color: '#1E3A8A',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
