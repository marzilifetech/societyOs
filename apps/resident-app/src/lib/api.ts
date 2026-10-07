import * as SecureStore from 'expo-secure-store';
import { ApiClient, type TokenPair } from '@societyos/api-client';
import { router } from 'expo-router';

// Reference process.env.EXPO_PUBLIC_API_URL directly so babel-preset-expo
// inlines the value into the production bundle. (A dynamic/aliased lookup is
// NOT inlined and falls back to localhost in release builds.)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

let _cachedAccess: string | null = null;
let _cachedRefresh: string | null = null;

/**
 * Update both tokens in memory. The auth store also persists them to
 * SecureStore; this entry point is what the api-client uses internally
 * after a successful refresh-token rotation.
 */
export function setApiTokens(access: string | null, refresh: string | null) {
  _cachedAccess = access;
  _cachedRefresh = refresh;
}

/** Backwards-compat shim — older code may still import setApiToken. */
export function setApiToken(token: string | null) {
  _cachedAccess = token;
  if (!token) _cachedRefresh = null;
}

export async function loadApiToken() {
  _cachedAccess = await SecureStore.getItemAsync('auth_token');
  _cachedRefresh = await SecureStore.getItemAsync('refresh_token');
}

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('The request is taking longer than expected. Please check your connection and try again.'));
    }, TIMEOUT_MS);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function mapError(err: unknown): never {
  if (err instanceof Error) {
    // Already a friendly timeout message
    if (err.message.startsWith('The request is taking longer')) throw err;

    // Network errors (fetch throws TypeError when no response)
    if (err.name === 'TypeError' || err.message === 'Network request failed' || err.message === 'Failed to fetch') {
      throw new Error('Could not reach the server. Please check your internet connection.');
    }

    // 5xx — ApiClient throws with "Request failed: 5xx"
    const match = err.message.match(/Request failed: (\d+)/);
    if (match) {
      const status = parseInt(match[1], 10);
      if (status >= 500) throw new Error('Our service had a hiccup. Please try again in a moment.');
    }
  }
  throw err;
}

/**
 * The auth store, required lazily: auth.store imports this module, so a
 * top-level import would be a require cycle (with `api` undefined while the
 * store module initialises). By the time anything here runs, both modules
 * are fully loaded.
 */
function authStore(): typeof import('../store/auth.store')['useAuthStore'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store/auth.store').useAuthStore;
}

async function persistTokens(pair: TokenPair | null) {
  if (pair) {
    _cachedAccess = pair.accessToken;
    _cachedRefresh = pair.refreshToken;
    // Refresh token FIRST. Refresh tokens are single-use: if the app is
    // killed between these two writes, a stored NEW refresh token next to an
    // old access token still recovers on the next launch, while the reverse
    // left the already-used refresh token on disk, which the server treats
    // as token reuse and answers by ending the session.
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
    // Don't wipe SecureStore here — the auth store's clearAuth handles full
    // cleanup. Just drop the in-memory cache; the next protected request
    // will be unauthenticated and fall through to the unauthorized handler.
  }
}

/**
 * Guards against a burst of concurrent 401s (Home alone fires half a dozen
 * queries at launch) each running the sign-out and the navigation.
 */
let _signingOut = false;

/**
 * Terminal session end: the access token was rejected AND the refresh token
 * could not rescue it (see TERMINAL_401_CODES / tryRefresh in the api-client).
 * Mirrors staff-app's handler.
 *
 * This used to only `router.replace` to the society picker, once PER failed
 * request, while the session stayed in the store and in SecureStore:
 *
 *   1. Every 401 in the launch burst navigated again, so the screen visibly
 *      loaded several times in a row.
 *   2. The next cold start read the same dead token back, landed on Home,
 *      401'd and bounced again — on every launch, until the user signed in.
 *
 * Clearing the store makes the end terminal, and navigation happens once.
 * When there is no session left to end (late 401s from requests that were
 * already in flight) there is nothing to do, and nowhere new to go.
 */
async function handleSessionEnded() {
  if (_signingOut) return;
  _signingOut = true;
  _cachedAccess = null;
  _cachedRefresh = null;
  try {
    const store = authStore();
    if (!store.getState().token) return;
    // The server already ended the session, so the logout and device-token
    // calls could only 401 and delay the user getting back to sign-in.
    await store.getState().clearAuth({ revokeOnServer: false });
    try {
      router.replace('/(auth)/society-select' as any);
    } catch {
      // Navigator not mounted yet. Nothing is lost: the store now has no
      // session, so the root route sends the user to sign-in on its own.
    }
  } catch {
    /* never let sign-out bookkeeping throw into a query */
  } finally {
    _signingOut = false;
  }
}

const _base = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => _cachedAccess,
  getRefreshToken: () => _cachedRefresh,
  setTokens: persistTokens,
  onUnauthorized: () => {
    void handleSessionEnded();
  },
});

export const api = {
  get<T>(path: string): Promise<T> {
    return withTimeout(_base.get<T>(path)).catch(mapError);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return withTimeout(_base.post<T>(path, body)).catch(mapError);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return withTimeout(_base.patch<T>(path, body)).catch(mapError);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return withTimeout(_base.put<T>(path, body)).catch(mapError);
  },
  delete<T>(path: string): Promise<T> {
    return withTimeout(_base.delete<T>(path)).catch(mapError);
  },
};

/**
 * Authenticated GET that returns the raw response body, for non-JSON endpoints
 * such as CSV exports. Opening such a URL in the browser does not work: it
 * cannot carry the bearer token, so the API answers 401. Callers reach this
 * from a screen whose JSON queries have already run, so the cached access
 * token has been refreshed if it needed to be.
 */
export async function getText(path: string): Promise<string> {
  const res = await withTimeout(
    fetch(`${BASE_URL}${path}`, {
      headers: _cachedAccess ? { Authorization: `Bearer ${_cachedAccess}` } : {},
    }),
  );
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.text();
}
