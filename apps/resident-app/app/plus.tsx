import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Full-screen in-app WebView host for the "PLUS" / Care portal. Chosen over an
 * external browser tab so the experience is chrome-less AND camera-based record
 * uploads work reliably (a Custom Tab gets destroyed when the camera app comes
 * to the foreground; a hosted WebView survives it). The URL (already carrying a
 * one-time handoff token for seamless sign-in) is passed via the `url` param by
 * openCarePortal().
 */
export default function PlusWebView() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const canGoBack = useRef(false);

  const target = typeof url === 'string' && url ? url : 'https://society-admin-dev.marzitech.in/care';

  // Failsafe: the portal is an SPA that client-redirects (/care/enter -> /care),
  // so onLoadEnd doesn't always fire. Never let the loading overlay stick — hide
  // it after a few seconds regardless; the web app shows its own loading UI.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3500);
    return () => clearTimeout(t);
  }, []);

  // Android hardware back: navigate within the WebView first, else leave.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webRef.current?.goBack();
        return true;
      }
      return false; // let the router pop the screen
    });
    return () => sub.remove();
  }, []);

  const onNav = useCallback((navState: WebViewNavigation) => {
    canGoBack.current = navState.canGoBack;
  }, []);

  return (
    // Pad by the safe-area insets so the WebView's own sticky header sits BELOW
    // the status bar (the app is edge-to-edge, so without this the web header
    // renders under the clock/battery and is unreadable). The white padding
    // strips merge seamlessly with the portal's white header + bottom nav, so it
    // reads as one continuous app surface — matching the native screens.
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
      {/* Dark icons on the white strip, exactly like the app's other screens. */}
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <WebView
        ref={webRef}
        source={{ uri: target }}
        originWhitelist={['*']}
        // Session lives in localStorage (care-auth) — must persist.
        domStorageEnabled
        javaScriptEnabled
        // Camera + gallery for records upload. CAMERA permission is declared in
        // app config; react-native-webview wires the Android file chooser +
        // camera intent so <input type="file"> can capture a photo in-place.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        onNavigationStateChange={onNav}
        onLoadEnd={() => setLoading(false)}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.7) setLoading(false);
        }}
        // If the WebView content process dies (memory), reload rather than blank.
        onContentProcessDidTerminate={() => webRef.current?.reload()}
        style={styles.web}
      />

      {loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#6E0043" />
        </View>
      )}
      {/* No floating close overlay: the portal renders its own app-style header
          with a back chevron, and Android hardware-back / iOS swipe-back exits
          to the app (see the BackHandler above). An overlay button here would
          collide with the web header and is what made the top bar unreadable. */}
    </View>
  );
}

const styles = StyleSheet.create({
  // White so the safe-area padding strips blend into the portal's white header
  // and bottom nav rather than showing a maroon band.
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  web: { flex: 1, backgroundColor: '#F7F7FB' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
