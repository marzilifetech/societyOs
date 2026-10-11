import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { settleWithin, swallow } from '@societyos/mobile-core';
import { setApiTokens, api } from '../lib/api';
import { unregisterDeviceToken } from '../lib/push';
import { queryClient } from '../lib/query-client';
import { appNavigator } from '../lib/deferred-navigation';
import { disconnect as disconnectSocket } from '../lib/socket';

type AuthUser = { id: string; phone: string; role: string; status: string; name?: string | null };

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  societyId: string | null;
  isHydrated: boolean;
  setAuth: (
    accessToken: string,
    refreshToken: string | null,
    user: AuthState['user'],
    societyId: string,
  ) => Promise<void>;
  updateUser: (partial: Partial<NonNullable<AuthState['user']>>) => Promise<void>;
  /**
   * Sign out. `revokeOnServer: false` skips the logout call and doesn't wait
   * for the push-token release — used when the server has already ended the
   * session, where waiting would only delay getting the user back to sign-in.
   */
  clearAuth: (options?: { revokeOnServer?: boolean }) => Promise<void>;
  /**
   * Read the stored session again after launch gave up on it (a slow
   * Keystore). Resolves to whether a session is now in the store.
   */
  restoreSession: () => Promise<boolean>;
  /** Keep the store in step after the api-client rotates the token pair. */
  applyRefreshedTokens: (accessToken: string, refreshToken: string) => void;
  hydrate: () => Promise<void>;
}

/**
 * Upper bound on reading the stored session at launch.
 *
 * Every expo-module async call (SecureStore, all font loads, notifications)
 * runs on ONE native queue, and the Android Keystore behind SecureStore is
 * slow on some devices — Samsung's especially, and most of all just after a
 * reboot. The old 2.5s cap per key treated "slow" as "signed out" and sent
 * signed-in residents to the society picker. The boot screen shows a spinner
 * meanwhile, so waiting longer is the better failure mode; the budget only
 * exists so a Keystore that never answers can't hold the app forever.
 */
export const HYDRATE_BUDGET_MS = 8000;

const SESSION_KEYS = ['auth_token', 'refresh_token', 'society_id', 'auth_user'] as const;

type StoredSession = Pick<AuthState, 'token' | 'refreshToken' | 'societyId'> & { user: AuthUser };

async function readStoredSession(): Promise<StoredSession | null> {
  const [token, refreshToken, societyId, userJson] = await Promise.all(
    SESSION_KEYS.map((key) => SecureStore.getItemAsync(key).catch(() => null)),
  );
  if (!token || !societyId || !userJson) return null;
  // Parse BEFORE anything is applied: a corrupt user record must leave the
  // app cleanly signed out, not holding API tokens the store doesn't know of.
  const user = JSON.parse(userJson) as AuthUser | null;
  if (!user || typeof user !== 'object') return null;
  return { token, refreshToken, societyId, user };
}

/** Shared by every caller while a read is in flight, so launch reads once. */
let hydration: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
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

  clearAuth: async ({ revokeOnServer = true } = {}) => {
    // Release this phone's push token on EVERY path, a forced sign-out too
    // (the release needs no session), so the next resident to sign in here
    // gets their own pushes and stops getting this one's. Bounded and never
    // throws; a registration made meanwhile waits for it (see push.ts).
    const released = unregisterDeviceToken();
    if (revokeOnServer) {
      // Best-effort server revoke while the session is still valid. Bounded:
      // on a dead connection this used to hold the Sign out button for the
      // full request timeout. Failure is ignored — the AT and RT family still
      // expire on their TTL, and local state is wiped regardless.
      // The refresh token lets the server end this session's whole token
      // family, not just the current access token.
      const refreshToken = get().refreshToken;
      const logout = settleWithin(
        swallow(() => api.post('/auth/logout', refreshToken ? { refreshToken } : {})),
        5000,
        undefined,
      );
      await Promise.all([released, logout]);
    }
    // Local state first: the moment the session is gone in memory, every
    // screen and late-arriving 401 sees it, even if a Keystore delete is slow.
    setApiTokens(null, null);
    disconnectSocket();
    // A tap held for the signed-in shell pointed into this session.
    appNavigator.clearPending();
    set({ token: null, refreshToken: null, user: null, societyId: null, isHydrated: true });
    await Promise.all([
      // The next person to use this phone must not see this resident's
      // cached bills, visitors or complaints.
      swallow(() => queryClient.clear()),
      ...SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)),
    ]);
  },

  restoreSession: async () => {
    if (get().token) return true;
    // Joins a launch read still in flight; otherwise reads afresh.
    if (!get().isHydrated) {
      await get().hydrate();
      return !!get().token;
    }
    const session = await settleWithin(readStoredSession(), HYDRATE_BUDGET_MS, null);
    // Signed in some other way while this was reading: keep that session.
    if (session && !get().token) {
      setApiTokens(session.token, session.refreshToken);
      set({ ...session, isHydrated: true });
    }
    return !!get().token;
  },

  applyRefreshedTokens: (accessToken, refreshToken) => {
    // Only a live session is refreshed; a refresh landing after sign-out
    // must not resurrect one.
    if (!get().token) return;
    set({ token: accessToken, refreshToken });
  },

  hydrate: () => {
    // Idempotent: the root layout starts this at import time, ahead of the
    // font loads on the shared native queue, and later callers join it.
    if (get().isHydrated) return Promise.resolve();
    if (hydration) return hydration;

    hydration = (async () => {
      // Never rejects: a throw (corrupt record) or the budget running out
      // both settle to "no session".
      const session = await settleWithin(readStoredSession(), HYDRATE_BUDGET_MS, null);
      if (session) {
        setApiTokens(session.token, session.refreshToken);
        set({ ...session, isHydrated: true });
      } else {
        // Hydration MUST complete: the boot gate holds the whole UI on it.
        set({ isHydrated: true });
      }
    })().finally(() => {
      hydration = null;
    });
    return hydration;
  },
}));
