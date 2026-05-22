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

export const api = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => _cachedAccess,
  getRefreshToken: () => _cachedRefresh,
  setTokens: persistTokens,
  onUnauthorized: () => {
    _cachedAccess = null;
    _cachedRefresh = null;
    router.replace('/(auth)/phone-entry' as any);
  },
});
