import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuthStore } from '@/store/auth.store';

/** Everything the console keeps in localStorage for a session. */
export const SESSION_STORAGE_KEYS = [
  'admin-auth', // the persisted auth store (name in store/auth.store.ts)
  'admin_token',
  'admin_refresh_token',
  'admin_selected_society_id',
] as const;

export function clearStoredSession(): void {
  for (const key of SESSION_STORAGE_KEYS) localStorage.removeItem(key);
}

/**
 * Sign out for real. "Sign out" used to only clear the in-memory store: the
 * refresh token was never revoked on the server, cached data and the chosen
 * society stayed in the browser, and the page stayed where it was until some
 * later request happened to fail.
 */
export async function signOut(queryClient: QueryClient): Promise<void> {
  try {
    // With the refresh token the server ends the whole session, not just the
    // current access token.
    const refreshToken = useAuthStore.getState().refreshToken;
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
  } catch {
    /* the session is ended locally regardless */
  }
  useAuthStore.getState().clearAuth();
  clearStoredSession();
  queryClient.clear();
  window.location.replace('/login');
}
