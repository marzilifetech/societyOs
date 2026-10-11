/**
 * useAuthStore — session persistence, the launch read, and sign-out.
 *
 * The hydrate cases cover the launch hang this store used to cause: a
 * SecureStore read that throws (Keystore error), a corrupt stored user, and a
 * Keystore that never answers must all end "signed out and hydrated" — never
 * a rejected promise, never a pending one.
 */
jest.mock('../src/lib/api', () => {
  // The client sign-out's server calls use, bound to the captured session.
  const sessionClient = {
    post: jest.fn().mockResolvedValue({}),
    delete: jest.fn(),
    refreshToken: jest.fn(() => 'rt'),
  };
  return {
    setApiToken: jest.fn(),
    setApiTokens: jest.fn(),
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
    clientForSession: jest.fn(() => sessionClient),
  };
});
jest.mock('../src/lib/notifications', () => ({
  unregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/lib/query-client', () => ({
  clearQueryCache: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from 'expo-secure-store';
import { useAuthStore, HYDRATE_BUDGET_MS } from '../src/store/auth.store';
import { useLockStore } from '../src/store/lock.store';
import { setApiTokens, clientForSession } from '../src/lib/api';
import { unregisterDeviceToken } from '../src/lib/notifications';
import { clearQueryCache } from '../src/lib/query-client';
import { appNavigator } from '../src/lib/navigation';
import { PIN_KEY } from '../src/lib/pin';

/** Let the fire-and-forget server calls after the local wipe run. */
const flush = () => new Promise((r) => setImmediate(r));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;
const deleteItem = SecureStore.deleteItemAsync as jest.Mock;

const fakeUser = { id: 'u1', name: 'Ravi', phone: '+91999', role: 'STAFF', societyId: 'soc1' };

/** Serve SecureStore reads from a key → value map (order-independent). */
function storeHolds(values: Record<string, string | null | Error>) {
  getItem.mockImplementation(async (key: string) => {
    const v = values[key];
    if (v instanceof Error) throw v;
    return v ?? null;
  });
}

function resetStores() {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    societyId: null,
    isHydrated: false,
  });
  useLockStore.setState({ locked: false, hasPin: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  getItem.mockResolvedValue(null);
  resetStores();
});

describe('setAuth', () => {
  it('persists the session and updates the store', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    expect(setItem).toHaveBeenCalledWith('auth_token', 'tok');
    expect(setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(fakeUser));
    expect(setApiTokens).toHaveBeenCalledWith('tok', 'rt');
    expect(useAuthStore.getState()).toMatchObject({ token: 'tok', societyId: 'soc1', isHydrated: true });
  });

  it('writes the access token LAST, so a kill midway never leaves half a session', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    const keys = setItem.mock.calls.map(([k]) => k);
    expect(keys[keys.length - 1]).toBe('auth_token');
  });

  it('unlocks — signing in is authentication', async () => {
    useLockStore.setState({ locked: true });
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    expect(useLockStore.getState().locked).toBe(false);
  });

  it('rejects a missing or non-string access token', async () => {
    await expect(useAuthStore.getState().setAuth('', 'rt', fakeUser)).rejects.toThrow(
      'Cannot save session: access token is missing or not a string.',
    );
    await expect(useAuthStore.getState().setAuth(null as never, 'rt', fakeUser)).rejects.toThrow();
  });
});

describe('hydrate', () => {
  it('restores a stored session and locks it when a PIN exists', async () => {
    storeHolds({
      auth_token: 'persisted-tok',
      refresh_token: 'rt-persisted',
      auth_user: JSON.stringify(fakeUser),
      [PIN_KEY]: 'hash',
    });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({
      token: 'persisted-tok',
      refreshToken: 'rt-persisted',
      isHydrated: true,
    });
    expect(useAuthStore.getState().user?.id).toBe('u1');
    expect(setApiTokens).toHaveBeenCalledWith('persisted-tok', 'rt-persisted');
    expect(useLockStore.getState()).toMatchObject({ hasPin: true, locked: true });
  });

  it('does not lock a session without a PIN (the entry route asks for one)', async () => {
    storeHolds({ auth_token: 't', auth_user: JSON.stringify(fakeUser) });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBe('t');
    expect(useLockStore.getState()).toMatchObject({ hasPin: false, locked: false });
  });

  it('is signed out (and hydrated) when nothing is stored', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({ token: null, isHydrated: true });
  });

  it('is signed out when the token exists but the user record does not', async () => {
    storeHolds({ auth_token: 'tok' });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({ token: null, isHydrated: true });
    expect(setApiTokens).not.toHaveBeenCalled();
  });

  it('treats a corrupt user record as signed out, applies no tokens, and deletes it', async () => {
    storeHolds({ auth_token: 'tok', refresh_token: 'rt', auth_user: '{not json' });
    await expect(useAuthStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ token: null, isHydrated: true });
    expect(setApiTokens).not.toHaveBeenCalled();
    expect(deleteItem).toHaveBeenCalledWith('auth_token');
    expect(deleteItem).toHaveBeenCalledWith('auth_user');
  });

  it('treats a user record without an id or society as corrupt', async () => {
    storeHolds({ auth_token: 'tok', auth_user: JSON.stringify({ name: 'x' }) });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('never rejects when SecureStore throws (Keystore error) — the old launch hang', async () => {
    storeHolds({
      auth_token: new Error('DecryptException: Could not decrypt the item'),
      auth_user: new Error('DecryptException'),
    });
    await expect(useAuthStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ token: null, isHydrated: true });
  });

  it('gives up after the budget when the Keystore never answers', async () => {
    jest.useFakeTimers();
    try {
      getItem.mockImplementation(() => new Promise(() => {}));
      const done = useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isHydrated).toBe(false);
      await jest.advanceTimersByTimeAsync(HYDRATE_BUDGET_MS);
      await done;
      expect(useAuthStore.getState()).toMatchObject({ token: null, isHydrated: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it('reads the Keystore once for concurrent callers, and not again once hydrated', async () => {
    storeHolds({ auth_token: 'tok', auth_user: JSON.stringify(fakeUser) });
    await Promise.all([
      useAuthStore.getState().hydrate(),
      useAuthStore.getState().hydrate(),
      useAuthStore.getState().hydrate(),
    ]);
    const reads = getItem.mock.calls.length;
    expect(reads).toBe(4); // auth_token, refresh_token, auth_user, PIN — once each
    await useAuthStore.getState().hydrate();
    expect(getItem.mock.calls.length).toBe(reads);
  });
});

describe('clearAuth', () => {
  beforeEach(async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    useLockStore.setState({ hasPin: true, locked: false });
    jest.clearAllMocks();
  });

  it('wipes the session in memory and on disk, including the PIN', async () => {
    await useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isHydrated: true });
    expect(setApiTokens).toHaveBeenCalledWith(null, null);
    expect(deleteItem).toHaveBeenCalledWith('auth_token');
    expect(deleteItem).toHaveBeenCalledWith('refresh_token');
    expect(deleteItem).toHaveBeenCalledWith('auth_user');
    expect(deleteItem).toHaveBeenCalledWith(PIN_KEY);
    expect(useLockStore.getState()).toMatchObject({ hasPin: false, locked: false });
  });

  it("drops the cached data and any held deep link — the next guard must not see this guard's", async () => {
    const clearPending = jest.spyOn(appNavigator, 'clearPending');
    await useAuthStore.getState().clearAuth();
    expect(clearQueryCache).toHaveBeenCalled();
    expect(clearPending).toHaveBeenCalled();
  });

  it('unregisters the push token and revokes the session with the captured tokens', async () => {
    await useAuthStore.getState().clearAuth();
    await flush();
    expect(clientForSession).toHaveBeenCalledWith('tok', 'rt');
    const client = (clientForSession as jest.Mock).mock.results[0].value;
    expect(unregisterDeviceToken).toHaveBeenCalledWith(client);
    // The refresh token goes too, so the server revokes the whole family.
    expect(client.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'rt' });
    // Unregister must run while the session is still valid.
    expect((unregisterDeviceToken as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      client.post.mock.invocationCallOrder[0],
    );
  });

  it('wipes memory and the Keystore BEFORE any network, and never waits on it', async () => {
    // A server that never answers (the guard killed the app mid-sign-out).
    (unregisterDeviceToken as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    await useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().token).toBeNull();
    expect(deleteItem).toHaveBeenCalledWith('auth_token');
    expect(deleteItem).toHaveBeenCalledWith(PIN_KEY);
    expect(deleteItem).toHaveBeenCalledWith('staff_pin_attempts');
    expect(deleteItem.mock.invocationCallOrder[0]).toBeLessThan(
      (clientForSession as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('skips server calls when the server already ended the session', async () => {
    await useAuthStore.getState().clearAuth({ revokeOnServer: false });
    await flush();
    expect(unregisterDeviceToken).not.toHaveBeenCalled();
    expect(clientForSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('still signs out locally when logout fails and a Keystore delete throws', async () => {
    const client = (clientForSession as jest.Mock)('x', null);
    (clientForSession as jest.Mock).mockClear();
    client.post.mockRejectedValueOnce(new Error('offline'));
    deleteItem.mockRejectedValue(new Error('keystore'));
    await expect(useAuthStore.getState().clearAuth()).resolves.toBeUndefined();
    await flush();
    expect(useAuthStore.getState().token).toBeNull();
    deleteItem.mockReset();
  });
});

describe('applyRefreshedTokens', () => {
  it('updates a live session', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    useAuthStore.getState().applyRefreshedTokens('tok2', 'rt2');
    expect(useAuthStore.getState()).toMatchObject({ token: 'tok2', refreshToken: 'rt2' });
  });

  it('never resurrects a session after sign-out', () => {
    useAuthStore.getState().applyRefreshedTokens('tok2', 'rt2');
    expect(useAuthStore.getState().token).toBeNull();
  });
});
