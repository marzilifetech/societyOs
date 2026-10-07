import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SplashMark } from './SplashMark';

/** Must match `splash.backgroundColor` in app.json. */
export const BOOT_BACKGROUND = '#6E0043';

/** A launch shorter than this never shows a spinner — it would only flash. */
export const SPINNER_DELAY_MS = 1200;
/** Past this, say something, so a slow start never reads as a frozen app. */
export const REASSURE_DELAY_MS = 6000;

/**
 * Size Android 12+ draws the launcher icon at on the OS splash. The window
 * background (plugins/withAndroidNoSystemSplash.js) draws it at this size too,
 * so all three launch stages put the same logo in the same place.
 */
export const ANDROID_SPLASH_ICON_DP = 240;

type Phase = 'logo' | 'spinner' | 'reassure';

function hideNativeSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

/**
 * The in-app continuation of the native splash, shown while launch work
 * (reading the session, loading fonts, the first redirect) finishes.
 *
 * Previously this was a bare maroon view, then a blank grey screen during the
 * first redirect: a logo that vanished for seconds on a slow phone, which looks
 * exactly like an app that has hung.
 *
 * The logo matches the native splash on each platform:
 *  - Android: the launcher mark at the OS splash-icon size, centred, drawn
 *    with Views so it is on screen in the very first frame (see SplashMark).
 *  - iOS: `splash.png` filling the screen with `contain`, exactly as the
 *    native splash draws it. The native splash stays up until this image has
 *    loaded, then hides — so there is never a frame without the logo. The
 *    image is given an explicit size: React Native otherwise applies its
 *    intrinsic 1024×1024 as width/height.
 */
export function BootScreen() {
  const [phase, setPhase] = useState<Phase>('logo');
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    // Android's native splash isn't held by JS (plugins/withAndroidNoSystemSplash.js),
    // so this is a no-op there; kept so the call is never missed.
    if (isAndroid) hideNativeSplash();
    const spinner = setTimeout(() => setPhase('spinner'), SPINNER_DELAY_MS);
    const reassure = setTimeout(() => setPhase('reassure'), REASSURE_DELAY_MS);
    return () => {
      clearTimeout(spinner);
      clearTimeout(reassure);
    };
  }, [isAndroid]);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading, please wait"
      testID="boot-screen"
    >
      {isAndroid ? (
        <SplashMark size={ANDROID_SPLASH_ICON_DP} testID="boot-logo" />
      ) : (
        <Image
          source={require('../../assets/splash.png')}
          style={styles.iosLogo}
          resizeMode="contain"
          fadeDuration={0}
          onLoadEnd={hideNativeSplash}
          testID="boot-logo"
        />
      )}
      {phase !== 'logo' ? (
        <View style={styles.status} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" testID="boot-spinner" />
          {phase === 'reassure' ? (
            <Text style={styles.message} maxFontSizeMultiplier={1.6}>
              Please wait, still loading…
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BOOT_BACKGROUND,
  },
  iosLogo: {
    width: '100%',
    height: '100%',
  },
  status: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '64%',
    alignItems: 'center',
  },
  message: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
  },
});
