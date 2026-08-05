import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { setApiTokens, api } from '../lib/api';
import { unregisterDeviceToken } from '../lib/push';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: { id: string; phone: string; role: string; status: string; name?: string | null } | null;
  societyId: string | null;
  isHydrated: boolean;
  setAuth: (
    accessToken: string,
    refreshToken: string | null,
    user: AuthState['user'],
    societyId: string,
  ) => Promise<void>;
  updateUser: (partial: Partial<NonNullable<AuthState['user']>>) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  societyId: null,
  isHydrated: false,

  setAuth: async (accessToken, refreshToken, user, societyId) => {
    await SecureStore.setItemAsync('auth_token', accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    } else {
      // Defensive: a login response without a refresh token (legacy server)
      // means the app effectively has a single-token session — clear any
      // stale refresh from a previous login.
      await SecureStore.deleteItemAsync('refresh_token');
    }
    await SecureStore.setItemAsync('society_id', societyId);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    setApiTokens(accessToken, refreshToken);
    set({ token: accessToken, refreshToken, user, societyId, isHydrated: true });
  },

  updateUser: async (partial) => {
    let nextUser: AuthState['user'] = null;

    set((state) => {
      nextUser = state.user ? { ...state.user, ...partial } : null;
      return { user: nextUser };
    });

    if (nextUser) {
      await SecureStore.setItemAsync('auth_user', JSON.stringify(nextUser));
    }
  },

  clearAuth: async () => {
    // Best-effort server revoke before wiping local state. Failure is
    // intentionally ignored — if the server is unreachable, the AT and RT
    // family will still expire on their TTL, and the local state must be
    // wiped regardless.
    // Forget this device's push token server-side so a logged-out user stops
    // receiving pushes. Best-effort and must run while the token is still valid.
    await unregisterDeviceToken();
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* ignore */
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('society_id');
    await SecureStore.deleteItemAsync('auth_user');
    setApiTokens(null, null);
    set({ token: null, refreshToken: null, user: null, societyId: null, isHydrated: true });
  },

  hydrate: async () => {
    // Read all keys in PARALLEL, and cap each read so a slow/broken device
    // Keystore can never leave the app trapped on the splash screen. Hydration
    // MUST resolve — the RootLayout gate blocks the whole UI on `isHydrated`.
    const read = (key: string): Promise<string | null> =>
      Promise.race([
        SecureStore.getItemAsync(key).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
    try {
      const [token, refreshToken, societyId, userJson] = await Promise.all([
        read('auth_token'),
        read('refresh_token'),
        read('society_id'),
        read('auth_user'),
      ]);
      if (token && societyId && userJson) {
        setApiTokens(token, refreshToken);
        set({
          token,
          refreshToken,
          societyId,
          user: JSON.parse(userJson),
          isHydrated: true,
        });
        return;
      }
    } catch {
      /* fall through — always mark hydrated below so the UI can render */
    } finally {
      set({ isHydrated: true });
    }
  },
}));
