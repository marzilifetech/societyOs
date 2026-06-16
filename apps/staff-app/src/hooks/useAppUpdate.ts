import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '../lib/api';

/**
 * Mirrors apps/resident-app/src/hooks/useAppUpdate.ts intentionally — staff
 * + resident go through the SAME backend endpoint, only the `app` query
 * param differs. Kept as parallel files (not a shared package) for the same
 * reason as useNotificationPermission — adding a workspace package is more
 * churn than the duplication is worth.
 */
export type AppUpdateLevel = 'none' | 'flexible' | 'immediate';

export interface AppUpdatePolicy {
  level: AppUpdateLevel;
  minVersionCode: number;
  recommendedVersionCode: number;
  updateUrl: string;
  updateMessage: string | null;
}

const POLICY_RECHECK_MS = 60 * 60 * 1000;

export function useAppUpdate(appKey: 'resident' | 'staff' = 'staff'): AppUpdatePolicy | null {
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
        // Silent — boot path cannot be made worse by a config fetch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  return policy;
}

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
