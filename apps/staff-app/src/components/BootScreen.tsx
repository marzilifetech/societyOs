import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/** app.json `splash.backgroundColor` — also the Android window background. */
export const SPLASH_BACKGROUND = '#6E0043';

const SPINNER_AFTER_MS = 1200;
const STILL_LOADING_AFTER_MS = 6000;

/**
 * What shows between the native splash and the first real screen.
 *
 * The same colour as the splash and the window background, so launch is one
 * continuous surface (the old boot view was #821A52 on a #6E0043 window, a
 * visible jump that looked like a reload). A spinner appears only if launch
 * is slow, and a line of text if it is very slow, so a stalled launch never
 * looks like a frozen app.
 */
export function BootScreen() {
  const [showSpinner, setShowSpinner] = useState(false);
  const [showSlow, setShowSlow] = useState(false);

  useEffect(() => {
    // Hand over from the native splash as soon as this has drawn.
    SplashScreen.hideAsync().catch(() => {});
    const spinner = setTimeout(() => setShowSpinner(true), SPINNER_AFTER_MS);
    const slow = setTimeout(() => setShowSlow(true), STILL_LOADING_AFTER_MS);
    return () => {
      clearTimeout(spinner);
      clearTimeout(slow);
    };
  }, []);

  return (
    <View style={styles.root} testID="boot-screen" accessibilityLabel="Loading">
      {showSpinner ? <ActivityIndicator color="#FFFFFF" /> : null}
      {showSlow ? <Text style={styles.slow}>Still loading…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
  slow: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 12 },
});
