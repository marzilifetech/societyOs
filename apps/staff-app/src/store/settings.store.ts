import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api } from '../lib/api';

/**
 * Local pref key → backend notification-category key. Only keys with a true
 * backend equivalent are synced; the others (reviews, leave) gate UI badges
 * only. Push opt-out happens server-side via `notification_preferences` —
 * `tasks` and `announcements` here keep the lockscreen quiet for those
 * categories.
 */
const BACKEND_CATEGORY_MAP: Partial<Record<keyof NotificationPrefs, string>> = {
  tasks: 'staff_tasks',
  announcements: 'notices',
  helpRequests: 'staff_tasks',
};

let prefSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Best-effort debounced sync of local prefs → backend. Failures are swallowed
 * (network blips can't roll back a user toggle without confusing them).
 */
function scheduleBackendSync(prefs: NotificationPrefs) {
  if (prefSyncTimer) clearTimeout(prefSyncTimer);
  prefSyncTimer = setTimeout(() => {
    const payload: { category: string; enabled: boolean }[] = [];
    for (const [key, category] of Object.entries(BACKEND_CATEGORY_MAP) as [
      keyof NotificationPrefs,
      string,
    ][]) {
      payload.push({ category, enabled: prefs[key] });
    }
    if (payload.length === 0) return;
    api.patch('/notifications/preferences', { prefs: payload }).catch(() => {});
  }, 500);
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface NotificationPrefs {
  tasks: boolean;
  reviews: boolean;
  leave: boolean;
  announcements: boolean;
  helpRequests: boolean;
}

export interface BadgeCounts {
  tasks: number;
  reviews: number;
  helpRequests: number;
}

interface SettingsState {
  theme: ThemeMode;
  largeText: boolean;
  dataSaver: boolean;
  biometricEnabled: boolean;
  autoLockMinutes: number;
  notifications: NotificationPrefs;
  badges: BadgeCounts;
  hydrated: boolean;

  setTheme: (t: ThemeMode) => Promise<void>;
  setLargeText: (v: boolean) => Promise<void>;
  setDataSaver: (v: boolean) => Promise<void>;
  setBiometricEnabled: (v: boolean) => Promise<void>;
  setAutoLockMinutes: (n: number) => Promise<void>;
  setNotificationPref: (key: keyof NotificationPrefs, v: boolean) => Promise<void>;
  setBadge: (key: keyof BadgeCounts, n: number) => void;
  hydrate: () => Promise<void>;
}

const KEY = 'settings_v1';
const BIO_KEY = 'biometric_enabled';

const defaultNotifications: NotificationPrefs = {
  tasks: true,
  reviews: true,
  leave: true,
  announcements: true,
  helpRequests: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  largeText: false,
  dataSaver: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
  notifications: defaultNotifications,
  badges: { tasks: 0, reviews: 0, helpRequests: 0 },
  hydrated: false,

  setTheme: async (theme) => {
    set({ theme });
    await persist(get());
  },
  setLargeText: async (largeText) => {
    set({ largeText });
    await persist(get());
  },
  setDataSaver: async (dataSaver) => {
    set({ dataSaver });
    await persist(get());
  },
  setBiometricEnabled: async (v) => {
    set({ biometricEnabled: v });
    await SecureStore.setItemAsync(BIO_KEY, v ? '1' : '0');
  },
  setAutoLockMinutes: async (autoLockMinutes) => {
    set({ autoLockMinutes });
    await persist(get());
  },
  setNotificationPref: async (key, v) => {
    const next = { ...get().notifications, [key]: v };
    set({ notifications: next });
    await persist(get());
    scheduleBackendSync(next);
  },
  setBadge: (key, n) => {
    set({ badges: { ...get().badges, [key]: n } });
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          theme: parsed.theme ?? 'system',
          largeText: !!parsed.largeText,
          dataSaver: !!parsed.dataSaver,
          autoLockMinutes: parsed.autoLockMinutes ?? 5,
          notifications: { ...defaultNotifications, ...(parsed.notifications ?? {}) },
        });
      }
      const bio = await SecureStore.getItemAsync(BIO_KEY);
      set({ biometricEnabled: bio === '1' });
    } catch {}
    set({ hydrated: true });
  },
}));

async function persist(s: SettingsState) {
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        theme: s.theme,
        largeText: s.largeText,
        dataSaver: s.dataSaver,
        autoLockMinutes: s.autoLockMinutes,
        notifications: s.notifications,
      }),
    );
  } catch {}
}
