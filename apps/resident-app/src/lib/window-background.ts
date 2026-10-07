import { Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

/**
 * Android's window background is the splash (colour + logo, see
 * plugins/withAndroidNoSystemSplash.js) so the logo stays on screen between
 * the OS splash going away and the app's first frame, while the JS loads.
 *
 * Once a real screen is up it must become plain: Android 13+ screen
 * transitions briefly show the window background through BOTH screens, so
 * every navigation flashed maroon — and would now flash the logo. White
 * blends invisibly between the app's white screens.
 */
export const APP_WINDOW_BACKGROUND = '#FFFFFF';

/** After a real screen mounts: long enough for it to have drawn. */
export const SETTLE_AFTER_SCREEN_MS = 500;
/** Backstop for launches that never pass through the tabs or sign-in. */
export const SETTLE_FALLBACK_MS = 5000;

let settled = false;

/**
 * Swap the window background to the app's plain colour, once. Returns a
 * cleanup that cancels a pending swap (call it from an effect).
 */
export function settleWindowBackground(delayMs = SETTLE_AFTER_SCREEN_MS): () => void {
  if (settled || Platform.OS !== 'android') return () => {};
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    SystemUI.setBackgroundColorAsync(APP_WINDOW_BACKGROUND).catch(() => {
      settled = false; // try again on the next screen
    });
  }, delayMs);
  return () => clearTimeout(timer);
}

/** Test seam. */
export function __resetWindowBackgroundForTests(): void {
  settled = false;
}
