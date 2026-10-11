import { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

/**
 * "No internet" notice above every screen while the phone is offline.
 *
 * In-flow above the navigator (never covering a screen's header or back
 * button) and padded by the status-bar inset: the app draws edge-to-edge, so
 * unpadded its text ran under the clock and battery icons. Plain View, not
 * animated — see InAppBanner for why animations can't be relied on here.
 */
export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  // Context, not useSafeAreaInsets(): no provider (tests, very early boot)
  // means no inset rather than a crash.
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: topInset + 12 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="network-banner"
    >
      <Text style={styles.text}>No internet — please check your Wi-Fi or mobile data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#92400E',
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FEF3C7',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
