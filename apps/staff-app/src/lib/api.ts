import * as SecureStore from 'expo-secure-store';
import { ApiClient, type TokenPair } from '@societyos/api-client';
import { router } from 'expo-router';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

// SecureStore is async; cache tokens in memory once loaded. Auth store
// updates these on login/logout via setApiTokens; the api-client updates
// them itself after a successful refresh-token rotation via persistTokens.
let _cachedAccess: string | null = null;
let _cachedRefresh: string | null = null;

export function setApiTokens(access: string | null, refresh: string | null) {
  _cachedAccess = access;
  _cachedRefresh = refresh;
}

/** Backwards-compat shim — kept for any older imports. */
export function setApiToken(token: string | null) {
  _cachedAccess = token;
  if (!token) _cachedRefresh = null;
}

export async function loadApiToken() {
  _cachedAccess = await SecureStore.getItemAsync('auth_token');
  _cachedRefresh = await SecureStore.getItemAsync('refresh_token');
}

/**
 * The auth store, required lazily: auth.store imports this module, so a
 * top-level import would be a require cycle (with `api` undefined while the
 * store module initialises). By the time anything here runs, both modules
 * are fully loaded.
 */
function authStore(): (typeof import('../store/auth.store'))['useAuthStore'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store/auth.store').useAuthStore;
}

async function persistTokens(pair: TokenPair | null) {
  if (pair) {
    _cachedAccess = pair.accessToken;
    _cachedRefresh = pair.refreshToken;
    // Refresh token FIRST. Refresh tokens are single-use: if the app is killed
    // between these two writes, a stored NEW refresh token next to an old
    // access token still recovers on the next launch, while the reverse left
    // the already-used refresh token on disk, which the server treats as token
    // reuse and answers by ending the session.
    await SecureStore.setItemAsync('refresh_token', pair.refreshToken);
    await SecureStore.setItemAsync('auth_token', pair.accessToken);
    // Keep the auth store in step, so code that reads the token from it
    // (socket auth, push registration) never holds a rotated-out one.
    try {
      authStore().getState().applyRefreshedTokens(pair.accessToken, pair.refreshToken);
    } catch {
      /* bookkeeping only — must never turn a good refresh into a failure */
    }
  } else {
    _cachedAccess = null;
    _cachedRefresh = null;
  }
}

/**
 * Guards against a burst of concurrent 401s (Home alone fires five queries)
 * each running the sign-out + navigation.
 */
let _signingOut = false;

/**
 * Terminal session end: the access token was rejected AND the refresh token
 * could not rescue it (see TERMINAL_401_CODES / tryRefresh in the api-client).
 *
 * This used to clear ONLY the in-memory token cache and navigate away. Both
 * SecureStore keys and the auth store survived, which produced a session that
 * was dead on the server but alive on the device:
 *
 *   1. Every query 401s, so Home renders "Your home screen couldn't be
 *      loaded" — a dead end whose "Try Again" can never succeed.
 *   2. On the next cold start `useAuthStore.hydrate()` reads the same stale
 *      token back out of SecureStore and re-caches it, so the app still
 *      believes it is signed in and lands the user right back on the broken
 *      Home instead of on the login flow.
 *
 * Reproduced on device against an expired staff session. Clearing the store
 * (which also deletes the SecureStore keys) is what makes the state actually
 * terminal, so the root layout's auth gate sees `token === null` and routes to
 * sign-in on this launch and every launch after it.
 */
async function handleSessionEnded() {
  if (_signingOut) return;
  _signingOut = true;
  _cachedAccess = null;
  _cachedRefresh = null;
  try {
    const store = authStore();
    // Late 401s from requests already in flight: the session is already gone,
    // and so is the need to navigate anywhere.
    if (!store.getState().token) return;
    // The server already ended the session, so the logout and device-token
    // calls could only 401 — and used to hold the user on a dead screen for up
    // to the request timeout before navigating.
    await store.getState().clearAuth({ revokeOnServer: false });
    router.replace('/(auth)/society-select' as never);
  } catch {
    // Even if the store could not be cleared, still get the user somewhere
    // they can act rather than leaving them on a screen that cannot recover.
    router.replace('/(auth)/society-select' as never);
  } finally {
    _signingOut = false;
  }
}

export const api = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => _cachedAccess,
  getRefreshToken: () => _cachedRefresh,
  setTokens: persistTokens,
  onUnauthorized: () => {
    void handleSessionEnded();
  },
});

/**
 * A client bound to a session that sign-out has ALREADY wiped locally.
 *
 * Sign-out clears memory and the Keystore first, so killing the app during a
 * slow logout can't leave a session (or the PIN lockout) to come back to; the
 * server calls go out afterwards with the tokens captured before the wipe. This
 * client can still refresh an expired access token for them, but writes the
 * rotated pair nowhere and never runs the sign-out path above.
 */
export function clientForSession(
  accessToken: string,
  refreshToken: string | null,
): ApiClient & { refreshToken: () => string | null } {
  let access: string | null = accessToken;
  let refresh = refreshToken;
  const client = new ApiClient({
    baseUrl: BASE_URL,
    getToken: () => access,
    getRefreshToken: () => refresh,
    setTokens: (pair) => {
      access = pair?.accessToken ?? null;
      refresh = pair?.refreshToken ?? null;
    },
  });
  // The CURRENT refresh token: a refresh on the way rotates the captured one.
  return Object.assign(client, { refreshToken: () => refresh });
}
