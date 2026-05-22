import * as SecureStore from 'expo-secure-store';
import { ApiClient, type TokenPair } from '@societyos/api-client';
import { router } from 'expo-router';

const runtimeProcess = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const BASE_URL = runtimeProcess.process?.env?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

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

async function persistTokens(pair: TokenPair | null) {
  if (pair) {
    _cachedAccess = pair.accessToken;
    _cachedRefresh = pair.refreshToken;
    await SecureStore.setItemAsync('auth_token', pair.accessToken);
    await SecureStore.setItemAsync('refresh_token', pair.refreshToken);
  } else {
    _cachedAccess = null;
    _cachedRefresh = null;
    // Don't wipe SecureStore here — the auth store's clearAuth handles full
    // cleanup. Just drop the in-memory cache; the next protected request
    // will be unauthenticated and fall through to the unauthorized handler.
  }
}

function handleUnauthorized() {
  // Refresh has already been attempted and rejected by the time we get here.
  router.replace('/(auth)/society-select' as any);
}

const _base = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => _cachedAccess,
  getRefreshToken: () => _cachedRefresh,
  setTokens: persistTokens,
  onUnauthorized: handleUnauthorized,
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
