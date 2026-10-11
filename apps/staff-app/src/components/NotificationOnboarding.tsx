import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  setupNotificationCategories,
  setupAndroidChannels,
  subscribeToTokenRotation,
} from '../lib/notifications';
import {
  isIgnoringBatteryOptimizations,
  openBatteryOptimizationSettings,
} from '../lib/native-notifications';

const ASKED_KEY = 'notif_permission_asked_v1';
const BATTERY_ASKED_KEY = 'battery_exemption_asked_v1';

/**
 * Once per install, after notifications are on: offer to exempt the app from
 * battery optimisation. On the budget Android phones guards carry, an
 * optimised idle app has its pushes held back — an SOS can arrive late.
 */
async function offerBatteryExemptionOnce(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (await AsyncStorage.getItem(BATTERY_ASKED_KEY)) return;
  if ((await isIgnoringBatteryOptimizations()) !== false) return;
  await AsyncStorage.setItem(BATTERY_ASKED_KEY, '1');
  Alert.alert(
    'Get alerts instantly',
    'Your phone may delay SOS and visitor alerts to save battery. On the next screen, find Marzi Staff and choose "Don\'t optimise". You can change this later in Settings → Notifications.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Open settings', onPress: () => void openBatteryOptimizationSettings() },
    ],
  );
}

/**
 * Silent, native-first notification onboarding. Renders NOTHING.
 *
 * WHY THERE IS NO UI HERE
 * -----------------------
 * This replaces two surfaces that were removed:
 *
 *   • `NotificationPermissionBanner` — a persistent strip pinned over the top
 *     of every screen while permission was off. It covered content, could not
 *     be dismissed, and re-appeared on every launch. Users read it as breakage,
 *     not guidance.
 *   • `NotificationPrimerModal` — a full-screen "why we need notifications"
 *     interstitial shown BEFORE the OS dialog. It was already dead code (never
 *     mounted), and the pattern doubles the number of taps to reach the same
 *     system prompt.
 *
 * The replacement is the OS's own dialog, asked once, at the moment it makes
 * sense (right after sign-in, when the app has just become useful and the ask
 * is self-evidently relevant). Everything after that lives in
 * `app/settings/notifications.tsx`, which the user opens deliberately
 * instead of having it pushed at them.
 *
 * ORDERING MATTERS
 * ----------------
 * Categories and channels are set up BEFORE the permission request, so the
 * very first notification that arrives after the user taps "Allow" already has
 * its channel and its iOS action buttons in place. (On Android the channels
 * are additionally created natively in Application.onCreate — see
 * plugins/withNativeNotifications.js — so `setupAndroidChannels()` is a cheap
 * no-op there and this ordering only matters for iOS.)
 *
 * ASKING ONCE
 * -----------
 * `ASKED_KEY` guards the *first* prompt. On Android 13+ a second
 * `requestPermissionsAsync()` after a denial is a silent no-op (the OS shows
 * nothing), so without the guard the app would look like it was doing
 * something and then do nothing at all. Once the user has been asked, the only
 * route back is the settings screen, which deep-links into the OS.
 */
export function NotificationOnboarding({ userId }: { userId: string | null }) {
  useEffect(() => {
    // One run per signed-in session (keyed on the user), not per process: a
    // shared guard phone signs guards in and out without the app restarting,
    // and each of them must get this device registered to THEM.
    if (!userId) return undefined;
    let cancelled = false;

    const register = async (mayPrompt: boolean) => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled) return;

        // Already granted: (re)register the device token. Deduplicated inside,
        // so repeating this on every foreground costs no network once it has
        // succeeded — and retries it if it has not.
        if (status === 'granted') {
          await registerForPushNotifications();
          if (mayPrompt) await offerBatteryExemptionOnce();
          return;
        }

        // Explicitly denied earlier — re-asking does nothing on Android 13+.
        // The settings screen is the only way forward.
        if (!mayPrompt || status !== 'undetermined') return;

        const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
        if (cancelled || alreadyAsked) return;
        await AsyncStorage.setItem(ASKED_KEY, '1');

        // registerForPushNotifications() performs the OS request itself and
        // only proceeds to token registration when it is granted.
        if (await registerForPushNotifications()) await offerBatteryExemptionOnce();
      } catch {
        // Never let notification setup break the app. A failure here costs
        // notifications until the next foreground retry, not the session.
      }
    };

    void (async () => {
      try {
        await setupAndroidChannels();
        await setupNotificationCategories();
      } catch {
        /* channels also exist natively; categories are iOS-only niceties */
      }
      await register(true);
    })();

    // A failed registration (offline at sign-in, server blip) used to stay
    // failed until the app was killed — for days on an always-on guard phone.
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void register(false);
    });
    // FCM can rotate the token mid-session; follow it.
    const rotationSub = subscribeToTokenRotation();

    return () => {
      cancelled = true;
      appStateSub.remove();
      rotationSub.remove();
    };
  }, [userId]);

  return null;
}
