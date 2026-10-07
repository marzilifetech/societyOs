/**
 * Tests for apps/resident-app/src/store/auth.store.ts
 *
 * setAuth, updateUser, clearAuth (with and without the server revoke),
 * applyRefreshedTokens, and hydrate — including the launch guarantees the
 * boot screen depends on: hydrate always resolves, reads the Keystore once
 * however many callers ask, and gives up after HYDRATE_BUDGET_MS.
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

jest.mock('../src/lib/push', () => ({
  unregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from 'expo-secure-store';
import { useAuthStore, HYDRATE_BUDGET_MS } from '../src/store/auth.store';
import { api, setApiTokens } from '../src/lib/api';
import { unregisterDeviceToken } from '../src/lib/push';

const mockUser = { id: 'u1', phone: '+91', role: 'RESIDENT', status: 'ACTIVE', name: 'Alice' };

const getItem = SecureStore.getItemAsync as jest.Mock;
const deleteItem = SecureStore.deleteItemAsync as jest.Mock;

/** Serve SecureStore reads from a key → value map. */
function storeContains(values: Record<string, string | null>) {
  getItem.mockImplementation((key: string) => Promise.resolve(values[key] ?? null));
}

const FULL_SESSION = {
  auth_token: 'tok-hydrated',
  refresh_token: 'rt-hydrated',
  society_id: 'soc-hydrated',
  auth_user: JSON.stringify(mockUser),
};

function resetStore() {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    societyId: null,
    isHydrated: false,
  });
}

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItem.mockReset().mockResolvedValue(null);
    deleteItem.mockReset().mockResolvedValue(undefined);
    resetStore();
  });

  // ─── setAuth ───────────────────────────────────────────────────────────────

  describe('setAuth', () => {
    it('persists token, refresh token, societyId, and user to SecureStore', async () => {
      await useAuthStore.getState().setAuth('tok-1', 'rt-1', mockUser, 'soc-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'rt-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('society_id', 'soc-1');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user', JSON.stringify(mockUser));
    });

    it('clears a stale refresh token when the server sent none', async () => {
      await useAuthStore.getState().setAuth('tok-1', null, mockUser, 'soc-1');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });

    it('updates store state correctly', async () => {
      await useAuthStore.getState().setAuth('tok-1', 'rt-1', mockUser, 'soc-1');
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-1');
      expect(state.user).toEqual(mockUser);
      expect(state.societyId).toBe('soc-1');
      expect(state.isHydrated).toBe(true);
      expect(setApiTokens).toHaveBeenCalledWith('tok-1', 'rt-1');
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
    beforeEach(() => {
      useAuthStore.setState({ token: 'tok', refreshToken: 'rt', user: mockUser, societyId: 'soc-1' });
    });

    it('deletes all SecureStore keys', async () => {
      await useAuthStore.getState().clearAuth();
      ['auth_token', 'refresh_token', 'society_id', 'auth_user'].forEach((key) =>
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key),
      );
    });

    it('resets store state and the API token cache', async () => {
      await useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.societyId).toBeNull();
      expect(state.isHydrated).toBe(true);
      expect(setApiTokens).toHaveBeenCalledWith(null, null);
    });

    it('revokes on the server by default (device token, then logout)', async () => {
      await useAuthStore.getState().clearAuth();
      expect(unregisterDeviceToken).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith('/auth/logout', {});
    });

    it('still signs out locally when the server logout fails', async () => {
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('offline'));
      await useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('skips every server call with revokeOnServer: false', async () => {
      await useAuthStore.getState().clearAuth({ revokeOnServer: false });
      expect(unregisterDeviceToken).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('clears the in-memory session BEFORE the Keystore deletes finish', async () => {
      const outstanding: Array<() => void> = [];
      deleteItem.mockImplementation(
        () => new Promise<void>((resolve) => { outstanding.push(resolve); }),
      );
      const pending = useAuthStore.getState().clearAuth({ revokeOnServer: false });
      // Deletes still outstanding, but nothing can see the session any more.
      expect(outstanding).toHaveLength(4);
      expect(useAuthStore.getState().token).toBeNull();
      outstanding.forEach((finish) => finish());
      await pending;
    });

    it('does not throw when a Keystore delete fails', async () => {
      deleteItem.mockRejectedValue(new Error('keystore busy'));
      await expect(
        useAuthStore.getState().clearAuth({ revokeOnServer: false }),
      ).resolves.toBeUndefined();
      expect(useAuthStore.getState().token).toBeNull();
    });
  });

  // ─── applyRefreshedTokens ───────────────────────────────────────────────────

  describe('applyRefreshedTokens', () => {
    it('replaces the token pair of a live session', () => {
      useAuthStore.setState({ token: 'old-at', refreshToken: 'old-rt', user: mockUser });
      useAuthStore.getState().applyRefreshedTokens('new-at', 'new-rt');
      expect(useAuthStore.getState().token).toBe('new-at');
      expect(useAuthStore.getState().refreshToken).toBe('new-rt');
    });

    it('never resurrects a session that was signed out meanwhile', () => {
      useAuthStore.getState().applyRefreshedTokens('new-at', 'new-rt');
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
    });
  });

  // ─── hydrate ────────────────────────────────────────────────────────────────

  describe('hydrate', () => {
    it('restores auth state when all keys are present in SecureStore', async () => {
      storeContains(FULL_SESSION);
      await useAuthStore.getState().hydrate();
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-hydrated');
      expect(state.refreshToken).toBe('rt-hydrated');
      expect(state.societyId).toBe('soc-hydrated');
      expect(state.user).toEqual(mockUser);
      expect(state.isHydrated).toBe(true);
      expect(setApiTokens).toHaveBeenCalledWith('tok-hydrated', 'rt-hydrated');
    });

    it('marks hydrated with no session when nothing is stored', async () => {
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isHydrated).toBe(true);
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('resolves (never rejects) and is signed out when SecureStore throws', async () => {
      getItem.mockRejectedValue(new Error('SecureStore unavailable'));
      await expect(useAuthStore.getState().hydrate()).resolves.toBeUndefined();
      expect(useAuthStore.getState().isHydrated).toBe(true);
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('does not restore if only some keys are present (token but no societyId)', async () => {
      storeContains({ ...FULL_SESSION, refresh_token: null, society_id: null });
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isHydrated).toBe(true);
    });

    it('a corrupt user record leaves the app cleanly signed out — no stray API tokens', async () => {
      storeContains({ ...FULL_SESSION, auth_user: '{not json' });
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isHydrated).toBe(true);
      expect(setApiTokens).not.toHaveBeenCalled();
    });

    it('treats a stored "null" user as no session', async () => {
      storeContains({ ...FULL_SESSION, auth_user: 'null' });
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('concurrent callers share ONE Keystore read', async () => {
      storeContains(FULL_SESSION);
      await Promise.all([
        useAuthStore.getState().hydrate(),
        useAuthStore.getState().hydrate(),
        useAuthStore.getState().hydrate(),
      ]);
      expect(getItem).toHaveBeenCalledTimes(4); // one per key, once
      expect(useAuthStore.getState().token).toBe('tok-hydrated');
    });

    it('does not read again once hydrated', async () => {
      storeContains(FULL_SESSION);
      await useAuthStore.getState().hydrate();
      getItem.mockClear();
      await useAuthStore.getState().hydrate();
      expect(getItem).not.toHaveBeenCalled();
    });

    describe('time budget', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('restores a session that is slow to read but inside the budget', async () => {
        // A slow Keystore used to be treated as "signed out" after 2.5s.
        getItem.mockImplementation(
          (key: string) =>
            new Promise((resolve) =>
              setTimeout(() => resolve((FULL_SESSION as Record<string, string>)[key]), 5000),
            ),
        );
        const done = useAuthStore.getState().hydrate();
        await jest.advanceTimersByTimeAsync(5000);
        await done;
        expect(useAuthStore.getState().token).toBe('tok-hydrated');
      });

      it('gives up at HYDRATE_BUDGET_MS when the Keystore never answers', async () => {
        getItem.mockImplementation(() => new Promise(() => {}));
        const done = useAuthStore.getState().hydrate();

        await jest.advanceTimersByTimeAsync(HYDRATE_BUDGET_MS - 1);
        expect(useAuthStore.getState().isHydrated).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        await done;
        expect(useAuthStore.getState().isHydrated).toBe(true);
        expect(useAuthStore.getState().token).toBeNull();
        expect(jest.getTimerCount()).toBe(0);
      });
    });
  });
});
