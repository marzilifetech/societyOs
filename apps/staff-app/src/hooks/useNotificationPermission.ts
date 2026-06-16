import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'undetermined';

/**
 * Lightweight hook around expo-notifications permission status. Polls on
 * mount and re-checks every time the app comes back to the foreground so a
 * user who flipped the OS toggle in Settings sees the in-app banner update
 * without restarting the app.
 *
 * Mirrors apps/resident-app/src/hooks/useNotificationPermission.ts so the
 * shared NotificationPermissionBanner component has the same API on both
 * apps. Keeping these as parallel files (rather than extracting to a
 * shared package) is the minimum-touch choice — the two apps already
 * duplicate similar lightweight hooks and a new workspace package would
 * be more churn than payoff.
 */
export function useNotificationPermission() {
  const [status, setStatus] = useState<PermissionState>('unknown');

  const refresh = useCallback(async () => {
    try {
      const { status: s } = await Notifications.getPermissionsAsync();
      if (s === 'granted') setStatus('granted');
      else if (s === 'denied') setStatus('denied');
      else setStatus('undetermined');
    } catch {
      setStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { status, refresh };
}
