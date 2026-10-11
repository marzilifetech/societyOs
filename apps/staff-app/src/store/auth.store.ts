import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { StaffUser } from '@societyos/api-client';
import { settleWithin, swallow } from '@societyos/mobile-core';
import { setApiTokens, clientForSession } from '../lib/api';
import { PIN_KEY, clearPin } from '../lib/pin';
import { clearQueryCache } from '../lib/query-client';
import { appNavigator } from '../lib/navigation';
import { unregisterDeviceToken } from '../lib/notifications';
import { disconnect as disconnectSocket } from '../lib/socket';
import { useLockStore } from './lock.store';
import { useSettingsStore } from './settings.store';

export type { StaffUser };

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: StaffUser | null;
  societyId: string | null;
  /** The stored session has been read (or given up on). Only ever goes false → true. */
  isHydrated: boolean;
  setAuth: (accessToken: string, refreshToken: string | null, user: StaffUser) => Promise<void>;
  /**
   * Sign out. `revokeOnServer: false` skips the logout and device-token calls
   * — used when the server has already ended the session, where those calls
   * can only 401 and would delay getting the user back to sign-in.
   */
  clearAuth: (options?: { revokeOnServer?: boolean }) => Promise<void>;
  /** Keep the store in step after the api-client rotates the token pair. */
  applyRefreshedTokens: (accessToken: string, refreshToken: string) => void;
  hydrate: () => Promise<void>;
}

/**
 * Upper bound on reading the stored session at launch.
 *
 * Every expo-module async call (SecureStore, font loads, notifications) runs on
 * ONE native queue, and the Android Keystore behind SecureStore is slow on some
 * devices — Samsung's especially, most of all just after a reboot. The boot
 * screen shows meanwhile, so waiting is the better failure mode; the budget
 * only exists so a Keystore that never answers can't hold the app forever.
 */
export const HYDRATE_BUDGET_MS = 8000;

const SESSION_KEYS = ['auth_token', 'refresh_token', 'auth_user'] as const;

interface StoredSession {
  token: string;
  refreshToken: string | null;
  user: StaffUser;
  hasPin: boolean;
}

function parseUser(json: string): StaffUser | null {
  try {
    const user = JSON.parse(json) as Partial<StaffUser> | null;
    if (!user || typeof user !== 'object' || typeof user.id !== 'string') return null;
    if (typeof user.societyId !== 'string') return null;
    return user as StaffUser;
  } catch {
    return null;
  }
}

async function deleteSessionKeys(): Promise<void> {
  await Promise.all(SESSION_KEYS.map((key) => swallow(() => SecureStore.deleteItemAsync(key))));
}

/**
 * Reads the whole session in ONE parallel batch, and never throws.
 *
 * The launch hang this replaces: `hydrate()` read three keys one after another
 * and `JSON.parse`d the user with no guard, inside a `Promise.all` that had no
 * catch. SecureStore throws on any Keystore error (common after a backup
 * restore and on some OEM Keystores), so the boot promise rejected,
 * `setReady(true)` never ran, and the app sat on the spinner forever — on every
 * launch, because the bad record was still stored.
 */
async function readStoredSession(): Promise<StoredSession | null> {
  const [token, refreshToken, userJson, pinHash] = await Promise.all(
    [...SESSION_KEYS, PIN_KEY].map((key) => swallow(() => SecureStore.getItemAsync(key))),
  );
  if (!token || !userJson) return null;
  // Parse BEFORE anything is applied: a corrupt user record must leave the app
  // cleanly signed out, not holding API tokens the store doesn't know about.
  const user = parseUser(userJson);
  if (!user) {
    await deleteSessionKeys();
    return null;
  }
  return { token, refreshToken: refreshToken ?? null, user, hasPin: !!pinHash };
}

/** Upper bound on sign-out's server calls, which run after the local wipe. */
export const REVOKE_BUDGET_MS = 10_000;

/**
 * Forget this device's push token, then end the session server-side. Guard
 * phones are shared: without the first, the next guard to sign in on this
 * phone kept receiving the previous guard's pushes. Unregistering goes first,
 * while the session is certainly still valid. Never rejects.
 */
async function revokeSession(token: string, refreshToken: string | null): Promise<void> {
  const client = clientForSession(token, refreshToken);
  await unregisterDeviceToken(client);
  // With the refresh token, the server revokes the whole token family — not
  // just this access token, which left a copied refresh token working for
  // its full lifetime. If this fails the family still expires on its TTL.
  const rt = client.refreshToken();
  await swallow(() => client.post('/auth/logout', rt ? { refreshToken: rt } : {}));
}

/** Shared by every caller while a read is in flight, so launch reads once. */
let hydration: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  societyId: null,
  isHydrated: false,

  setAuth: async (accessToken, refreshToken, user) => {
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Cannot save session: access token is missing or not a string.');
    }
    // The access token is written LAST: its presence is what marks a stored
    // session, so a kill midway leaves "signed out", never half a session.
    if (refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    } else {
      await SecureStore.deleteItemAsync('refresh_token');
    }
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    await SecureStore.setItemAsync('auth_token', accessToken);
    setApiTokens(accessToken, refreshToken);
    // Signing in IS authentication — no lock on top of it.
    useLockStore.getState().unlock();
    set({ token: accessToken, refreshToken, user, societyId: user.societyId, isHydrated: true });
  },

  clearAuth: async ({ revokeOnServer = true } = {}) => {
    // Captured BEFORE the wipe: the server calls run after it.
    const { token, refreshToken } = get();

    // Local state first: the moment the session is gone in memory, every
    // screen and late-arriving 401 sees it, even if a Keystore delete is slow.
    setApiTokens(null, null);
    disconnectSocket();
    appNavigator.clearPending();
    useLockStore.getState().reset();
    set({ token: null, refreshToken: null, user: null, societyId: null, isHydrated: true });
    // Then the Keystore — the session, the PIN and its failed-attempt counter
    // (clearPin) — BEFORE any network. The server calls used to come first, so
    // killing the app during a slow logout (say, right after the last wrong
    // PIN) left the whole session on disk to come back to.
    await Promise.all([
      deleteSessionKeys(),
      clearPin(),
      swallow(() => useSettingsStore.getState().setBiometricEnabled(false)),
    ]);
    // The next person to use this phone must not see this person's cached
    // tasks, visitors or salary — in memory or in the persisted cache.
    await swallow(clearQueryCache);

    if (revokeOnServer && token) {
      // Not awaited: sign-out is done once this device holds nothing. The
      // calls carry the captured session (the client's tokens are gone).
      void settleWithin(revokeSession(token, refreshToken), REVOKE_BUDGET_MS, undefined);
    }
  },

  applyRefreshedTokens: (accessToken, refreshToken) => {
    // Only a live session is refreshed; a refresh landing after sign-out must
    // not resurrect one.
    if (!get().token) return;
    set({ token: accessToken, refreshToken });
  },

  hydrate: () => {
    // Idempotent: the root layout starts this at import time, ahead of the
    // font loads on the shared native queue, and later callers join it.
    if (get().isHydrated) return Promise.resolve();
    if (hydration) return hydration;

    hydration = (async () => {
      // Never rejects: a throw (corrupt record) or the budget running out both
      // settle to "no session".
      const session = await settleWithin(readStoredSession(), HYDRATE_BUDGET_MS, null);
      if (session) {
        setApiTokens(session.token, session.refreshToken);
        // A restored session always starts locked when it has a PIN; without
        // one, the entry route sends the user to create one first.
        useLockStore.setState({ hasPin: session.hasPin, locked: session.hasPin });
        set({
          token: session.token,
          refreshToken: session.refreshToken,
          user: session.user,
          societyId: session.user.societyId,
          isHydrated: true,
        });
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
