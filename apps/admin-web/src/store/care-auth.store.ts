import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CARE_ACCESS_KEY, CARE_REFRESH_KEY } from '@/lib/care-api';

/**
 * Resident "Care" portal auth store — separate identity from the admin store.
 * Persists tokens to the `care_*` localStorage keys that `lib/care-api.ts`
 * reads, so a fresh login wires both access + refresh tokens.
 */
export interface CareUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  societyId: string;
  societyName?: string;
}

interface CareAuthState {
  token: string | null;
  refreshToken: string | null;
  user: CareUser | null;
  setAuth: (token: string, refreshToken: string, user: CareUser) => void;
  clearAuth: () => void;
}

export const useCareAuth = create<CareAuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => {
        localStorage.setItem(CARE_ACCESS_KEY, token);
        localStorage.setItem(CARE_REFRESH_KEY, refreshToken);
        set({ token, refreshToken, user });
      },
      clearAuth: () => {
        localStorage.removeItem(CARE_ACCESS_KEY);
        localStorage.removeItem(CARE_REFRESH_KEY);
        set({ token: null, refreshToken: null, user: null });
      },
    }),
    { name: 'care-auth' },
  ),
);
