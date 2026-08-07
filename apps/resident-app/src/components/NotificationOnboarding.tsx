import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  ensureAndroidChannels,
  ensurePermission,
  registerDeviceToken,
  setupNotificationCategories,
} from '../lib/push';

/**
 * Notification setup, run once the user is authenticated. Renders nothing.
 *
 * The old flow put a custom "may we send you notifications?" modal on Home and,
 * if the user said no, a permanent amber strip above every screen. That is two
 * bespoke surfaces asking for something the OS already has a dialog for, and
 * the strip sat over the header on every single screen forever.
 *
 * This asks the platform directly, once, right after sign-in — the moment the
 * user has committed to the app and the request has obvious context. Android 13+
 * and iOS both show their own dialog, so there is nothing of ours to look at.
 *
 * If the user declines there is no nagging: the OS will not show the dialog
 * again, so a second ask is impossible anyway. Recovery lives in Settings →
 * Notifications and in the setup screen, both reachable on demand.
 *
 * Ordering matters on Android: channels must exist BEFORE the first push lands,
 * otherwise it is filed under a fallback channel whose importance we don't
 * control. So channels are created even when permission is refused.
 */
const ASKED_KEY = 'notif_permission_asked_v2';

export function NotificationOnboarding({ active }: { active: boolean }) {
  // Guards against React 19 running the effect twice and firing two requests.
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      try {
        await ensureAndroidChannels();
        await setupNotificationCategories();

        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled) return;

        if (status === 'granted') {
          // Already allowed — make sure the backend has a current token. Tokens
          // rotate, and a reinstall produces a new one, so this is not a no-op.
          await registerDeviceToken();
          return;
        }

        // 'denied' means the OS will refuse to show the dialog again; asking
        // would silently do nothing. Only 'undetermined' is worth a prompt.
        if (status !== 'undetermined') return;

        const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
        if (cancelled || alreadyAsked) return;
        await AsyncStorage.setItem(ASKED_KEY, '1');

        const granted = await ensurePermission();
        if (cancelled || !granted) return;
        await registerDeviceToken();
      } catch {
        /* best-effort: never let notification setup break app start */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  return null;
}
