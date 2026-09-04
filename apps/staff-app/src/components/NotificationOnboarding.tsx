import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  setupNotificationCategories,
  setupAndroidChannels,
} from '../lib/notifications';

const ASKED_KEY = 'notif_permission_asked_v1';

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
export function NotificationOnboarding({ active }: { active: boolean }) {
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      try {
        await setupAndroidChannels();
        await setupNotificationCategories();

        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled) return;

        // Already granted: skip straight to (re)registering the device token.
        if (status === 'granted') {
          await registerForPushNotifications();
          return;
        }

        // Explicitly denied earlier — re-asking does nothing on Android 13+.
        // The settings screen is the only way forward.
        if (status !== 'undetermined') return;

        const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
        if (cancelled || alreadyAsked) return;
        await AsyncStorage.setItem(ASKED_KEY, '1');

        // registerForPushNotifications() performs the OS request itself and
        // only proceeds to token registration when it is granted.
        await registerForPushNotifications();
      } catch {
        // Never let notification setup break app start. A failure here costs
        // notifications; an unhandled rejection here costs the whole session.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  return null;
}
