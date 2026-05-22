import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  societyId: string;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  setAuth: (token: string, user: AdminUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('admin_token', token);
        set({ token, user });
      },
      clearAuth: () => {
        localStorage.removeItem('admin_token');
        set({ token: null, user: null });
      },
    }),
    { name: 'admin-auth' },
  ),
);
