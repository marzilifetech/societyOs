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
 * The status starts as "unknown" so we never flash a permission banner
 * before the first check resolves — a common bug with rendering on the
 * synchronous default of "undetermined".
 */
export function useNotificationPermission() {
  const [status, setStatus] = useState<PermissionState>('unknown');

  const refresh = useCallback(async () => {
    try {
      const { status: s } = await Notifications.getPermissionsAsync();
      // Map Expo's PermissionStatus enum to our narrow union — anything
      // unfamiliar falls through to undetermined so the banner shows safely.
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
