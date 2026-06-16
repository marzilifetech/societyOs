import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '../lib/api';

/**
 * Mirrors the backend `AppUpdateLevel` union — keep them lockstep.
 *
 *   none      — at-or-above recommended; no nudge
 *   flexible  — below recommended, above min; show dismissible banner
 *   immediate — below min; full-screen blocker
 */
export type AppUpdateLevel = 'none' | 'flexible' | 'immediate';

export interface AppUpdatePolicy {
  level: AppUpdateLevel;
  minVersionCode: number;
  recommendedVersionCode: number;
  updateUrl: string;
  updateMessage: string | null;
}

const POLICY_RECHECK_MS = 60 * 60 * 1000; // 1h — keeps cold starts honest without spamming

/**
 * Drives the in-app update gate + flexible banner.
 *
 * Why we drive this from a hook (vs. a one-shot at boot):
 *  - We re-fetch on AppState 'active' transitions so a user who triple-taps
 *    back to the app after the policy was flipped can be blocked without
 *    rebooting.
 *  - The endpoint is PUBLIC and intentionally cheap (5-min server cache),
 *    so an extra fetch per foreground is fine.
 *
 * Failure mode is silent: we render no banner, no blocker. The boot path
 * cannot be made worse by this hook. Senior-grade UX means "never crash
 * the user out of the app over a config fetch".
 */
export function useAppUpdate(appKey: 'resident' | 'staff' = 'resident'): AppUpdatePolicy | null {
  const [policy, setPolicy] = useState<AppUpdatePolicy | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchPolicy = async () => {
      if (Date.now() - lastFetchedAt < POLICY_RECHECK_MS && policy != null) return;
      const versionCode = readVersionCode();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      try {
        const res = await api.get<AppUpdatePolicy>(
          `/app/version-policy?app=${appKey}&platform=${platform}&versionCode=${versionCode}`,
        );
        if (!cancelled) {
          setPolicy(res);
          setLastFetchedAt(Date.now());
        }
      } catch {
        // Silent — see comment above. Either the network's down or the
        // backend is. Either way, the app must keep working.
      }
    };

    fetchPolicy();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') fetchPolicy();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
    // Re-fetch only when the appKey changes — `lastFetchedAt` is intentionally
    // excluded so we don't loop on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  return policy;
}

/**
 * Read the current build's versionCode from the bundled Expo config.
 * Expo prebuild bakes app.json's android.versionCode into the Gradle file
 * AND into Constants.expoConfig at runtime, so this is the same number a
 * Play Store / Internal App Sharing install would carry. Falls back to 0
 * (which the backend reads as "no policy applies") if the field is missing
 * — e.g. running under Expo Go for development.
 */
function readVersionCode(): number {
  const cfg = (Constants.expoConfig ?? Constants.manifest2 ?? Constants.manifest) as any;
  const fromAndroid = cfg?.android?.versionCode;
  if (typeof fromAndroid === 'number' && Number.isFinite(fromAndroid)) return fromAndroid;
  const fromIos = cfg?.ios?.buildNumber;
  if (typeof fromIos === 'string') {
    const n = Number.parseInt(fromIos, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
