import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { setApiTokens, api } from '../lib/api';

interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  societyId: string;
  department?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: StaffUser | null;
  societyId: string | null;
  setAuth: (accessToken: string, refreshToken: string | null, user: StaffUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  societyId: null,

  setAuth: async (accessToken, refreshToken, user) => {
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Cannot save session: access token is missing or not a string.');
    }
    await SecureStore.setItemAsync('auth_token', accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    } else {
      await SecureStore.deleteItemAsync('refresh_token');
    }
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    setApiTokens(accessToken, refreshToken);
    set({ token: accessToken, refreshToken, user, societyId: user.societyId });
  },

  clearAuth: async () => {
    // Best-effort server revoke; ignore failures so logout always succeeds locally.
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* ignore */
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('auth_user');
    setApiTokens(null, null);
    set({ token: null, refreshToken: null, user: null, societyId: null });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    const raw = await SecureStore.getItemAsync('auth_user');
    if (token && raw) {
      const user = JSON.parse(raw) as StaffUser;
      setApiTokens(token, refreshToken);
      set({ token, refreshToken, user, societyId: user.societyId });
    }
  },
}));
