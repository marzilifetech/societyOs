import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

/**
 * "No internet" notice above every screen while the phone is offline.
 *
 * Plain View, deliberately NOT animated. It used to fade in from opacity 0
 * with Animated, and on device it never became visible: on this app's React
 * Native setup (0.81, old architecture) an Animated value never reaches a view
 * that mounts after its screen's first render — and this banner only mounts
 * when the phone goes offline. Residents got an empty band at the top instead
 * of the message. Reproduced on the production build (1.0.14 / 20).
 *
 * It sits in-flow above the navigator and is padded by the status-bar inset:
 * the app draws edge-to-edge, so unpadded, its text ran under the clock and
 * battery icons. In-flow (not overlaid) so it never covers a screen's header
 * or back button while the phone is offline.
 */
export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  // Context, not useSafeAreaInsets(): no provider (tests, very early boot)
  // means no inset rather than a crash.
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
      setIsOffline(!state.isConnected);
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: topInset + 12 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="network-banner"
    >
      <Text style={styles.text}>No internet connection — please check your Wi-Fi or mobile data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FBF1D9',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154,107,0,0.18)',
  },
  text: { color: '#9A6B00', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
