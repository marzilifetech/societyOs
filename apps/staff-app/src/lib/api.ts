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

async function persistTokens(pair: TokenPair | null) {
  if (pair) {
    _cachedAccess = pair.accessToken;
    _cachedRefresh = pair.refreshToken;
    await SecureStore.setItemAsync('auth_token', pair.accessToken);
    await SecureStore.setItemAsync('refresh_token', pair.refreshToken);
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
    // Lazy import: auth.store imports this module, so a static import here
    // would be a require cycle (and `api` would be undefined at init time).
    const { useAuthStore } = await import('../store/auth.store');
    await useAuthStore.getState().clearAuth();
  } catch {
    // Even if the store could not be cleared, still get the user somewhere
    // they can act rather than leaving them on a screen that cannot recover.
  } finally {
    router.replace('/(auth)/society-select' as any);
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
