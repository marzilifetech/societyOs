/**
 * Tests for apps/resident-app/src/store/auth.store.ts
 *
 * Full coverage: setAuth, updateUser (with and without user), clearAuth, hydrate
 * (happy path, missing keys, and SecureStore throwing).
 */

jest.mock(
  '../src/lib/api',
  () => ({
    setApiToken: jest.fn(),
    setApiTokens: jest.fn(),
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  }),
  { virtual: false },
);

import { useAuthStore } from '../src/store/auth.store';
import * as SecureStore from 'expo-secure-store';

const mockUser = { id: 'u1', phone: '+91', role: 'RESIDENT', status: 'ACTIVE', name: 'Alice' };

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      societyId: null,
      isHydrated: false,
    });
  });

  // ─── setAuth ───────────────────────────────────────────────────────────────

  describe('setAuth', () => {
    it('persists token, societyId, and user to SecureStore', async () => {
      await useAuthStore.getState().setAuth('tok-1', 'rt-1', mockUser, 'soc-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('society_id', 'soc-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user', JSON.stringify(mockUser));
    });

    it('updates store state correctly', async () => {
      await useAuthStore.getState().setAuth('tok-1', 'rt-1', mockUser, 'soc-1');
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-1');
      expect(state.user).toEqual(mockUser);
      expect(state.societyId).toBe('soc-1');
      expect(state.isHydrated).toBe(true);
    });
  });

  // ─── updateUser ─────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('merges partial into existing user and persists', async () => {
      useAuthStore.setState({ user: mockUser });
      await useAuthStore.getState().updateUser({ name: 'Bob' });
      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Bob');
      expect(state.user?.id).toBe('u1'); // original fields preserved
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user', expect.stringContaining('Bob'));
    });

    it('does not call SecureStore when user is null', async () => {
      useAuthStore.setState({ user: null });
      await useAuthStore.getState().updateUser({ name: 'Bob' });
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── clearAuth ──────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('deletes all SecureStore keys', async () => {
      useAuthStore.setState({ token: 'tok', user: mockUser, societyId: 'soc-1' });
      await useAuthStore.getState().clearAuth();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('society_id');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
    });

    it('resets store state', async () => {
      useAuthStore.setState({ token: 'tok', user: mockUser, societyId: 'soc-1' });
      await useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.societyId).toBeNull();
      expect(state.isHydrated).toBe(true);
    });
  });

  // ─── hydrate ────────────────────────────────────────────────────────────────

  describe('hydrate', () => {
    it('restores auth state when all keys are present in SecureStore', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('tok-hydrated')            // auth_token
        .mockResolvedValueOnce('rt-hydrated')             // refresh_token
        .mockResolvedValueOnce('soc-hydrated')            // society_id
        .mockResolvedValueOnce(JSON.stringify(mockUser)); // auth_user
      await useAuthStore.getState().hydrate();
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-hydrated');
      expect(state.refreshToken).toBe('rt-hydrated');
      expect(state.societyId).toBe('soc-hydrated');
      expect(state.user).toEqual(mockUser);
      expect(state.isHydrated).toBe(true);
    });

    it('sets isHydrated via finally even when token is absent', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null); // all keys missing
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isHydrated).toBe(true);
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('sets isHydrated via finally even when SecureStore throws', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore unavailable'));
      await expect(useAuthStore.getState().hydrate()).rejects.toThrow('SecureStore unavailable');
      expect(useAuthStore.getState().isHydrated).toBe(true);
    });

    it('does not restore if only some keys are present (token but no societyId)', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('tok-only')                 // auth_token
        .mockResolvedValueOnce(null)                       // refresh_token missing
        .mockResolvedValueOnce(null)                       // society_id missing
        .mockResolvedValueOnce(JSON.stringify(mockUser));  // auth_user
      await useAuthStore.getState().hydrate();
      // Because societyId is null, the if-branch is not entered
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isHydrated).toBe(true);
    });
  });
});
