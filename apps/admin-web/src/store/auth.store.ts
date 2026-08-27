import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  // BUILDING_ADMIN is a block-scoped society admin and belongs in the console
  // like any other — see CONSOLE_ROLES in app/login/page.tsx.
  role: 'ADMIN' | 'BUILDING_ADMIN' | 'SUPER_ADMIN';
  societyId: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  setAuth: (token: string, refreshToken: string, user: AdminUser) => void;
  setTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
}

// Persistent localStorage keys consumed by `lib/api.ts` — kept in sync here
// so a fresh login wires up both access AND refresh tokens. Without the
// refresh token, any 401 (or token expiry past 15 min) immediately bounces
// the user back to /login because client.ts:tryRefresh has no token to use.
const ACCESS_KEY = 'admin_token';
const REFRESH_KEY = 'admin_refresh_token';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => {
        localStorage.setItem(ACCESS_KEY, token);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        set({ token, refreshToken, user });
      },
      setTokens: (token, refreshToken) => {
        localStorage.setItem(ACCESS_KEY, token);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        set({ token, refreshToken });
      },
      clearAuth: () => {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        set({ token: null, refreshToken: null, user: null });
      },
    }),
    { name: 'admin-auth' },
  ),
);
