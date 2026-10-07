/**
 * Session handling in src/lib/api.ts: what happens when the server ends the
 * session (onUnauthorized) and when the api-client rotates tokens
 * (setTokens).
 *
 * A launch with a dead session used to navigate to the society picker once
 * PER failed request and leave the session stored, so the screen visibly
 * reloaded several times — and again on every later launch.
 */

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));

const mockSetItem = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: (...a: unknown[]) => mockSetItem(...a),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

let mockCapturedConfig: any;
jest.mock('@societyos/api-client', () => ({
  ApiClient: jest.fn((config: unknown) => {
    mockCapturedConfig = config;
    return { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
  }),
}));

const mockStore = {
  token: 'live-token' as string | null,
  clearAuth: jest.fn(),
  applyRefreshedTokens: jest.fn(),
};
jest.mock('../src/store/auth.store', () => ({
  useAuthStore: { getState: () => mockStore },
}));

import { setApiTokens } from '../src/lib/api';

/** Let the async sign-out (dynamic import + awaits) run to completion. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function startSession() {
  mockStore.token = 'live-token';
  setApiTokens('live-token', 'live-refresh');
}

describe('api session handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clearAuth.mockImplementation(async () => {
      mockStore.token = null;
    });
    startSession();
  });

  describe('onUnauthorized (session ended by the server)', () => {
    it('signs out locally and navigates ONCE for a burst of 50 failed requests', async () => {
      for (let i = 0; i < 50; i += 1) mockCapturedConfig.onUnauthorized();
      await flush();

      expect(mockStore.clearAuth).toHaveBeenCalledTimes(1);
      expect(mockStore.clearAuth).toHaveBeenCalledWith({ revokeOnServer: false });
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/society-select');
    });

    it('drops the cached tokens immediately, so no further request carries them', () => {
      mockCapturedConfig.onUnauthorized();
      expect(mockCapturedConfig.getToken()).toBeNull();
      expect(mockCapturedConfig.getRefreshToken()).toBeNull();
    });

    it('late 401s after the sign-out do nothing — no second navigation', async () => {
      mockCapturedConfig.onUnauthorized();
      await flush();
      for (let i = 0; i < 10; i += 1) mockCapturedConfig.onUnauthorized();
      await flush();

      expect(mockStore.clearAuth).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no session to end', async () => {
      mockStore.token = null;
      mockCapturedConfig.onUnauthorized();
      await flush();
      expect(mockStore.clearAuth).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('survives the navigator not being mounted yet', async () => {
      mockReplace.mockImplementationOnce(() => {
        throw new Error('Attempted to navigate before mounting the Root Layout component.');
      });
      mockCapturedConfig.onUnauthorized();
      await flush();
      expect(mockStore.clearAuth).toHaveBeenCalledTimes(1);
    });

    it('recovers from a failing sign-out and handles the next one', async () => {
      mockStore.clearAuth.mockRejectedValueOnce(new Error('keystore busy'));
      mockCapturedConfig.onUnauthorized();
      await flush();

      startSession();
      mockCapturedConfig.onUnauthorized();
      await flush();
      expect(mockStore.clearAuth).toHaveBeenCalledTimes(2);
    });

    it('stress: 20 sign-in/expiry cycles of 30 overlapping 401s each', async () => {
      for (let cycle = 0; cycle < 20; cycle += 1) {
        startSession();
        for (let i = 0; i < 30; i += 1) mockCapturedConfig.onUnauthorized();
        await flush();
      }
      expect(mockStore.clearAuth).toHaveBeenCalledTimes(20);
      expect(mockReplace).toHaveBeenCalledTimes(20);
    });
  });

  describe('setTokens (token rotation)', () => {
    it('writes the refresh token BEFORE the access token', async () => {
      await mockCapturedConfig.setTokens({ accessToken: 'at-2', refreshToken: 'rt-2' });
      expect(mockSetItem.mock.calls).toEqual([
        ['refresh_token', 'rt-2'],
        ['auth_token', 'at-2'],
      ]);
    });

    it('serves the new pair to the client and syncs the auth store', async () => {
      await mockCapturedConfig.setTokens({ accessToken: 'at-2', refreshToken: 'rt-2' });
      expect(mockCapturedConfig.getToken()).toBe('at-2');
      expect(mockCapturedConfig.getRefreshToken()).toBe('rt-2');
      expect(mockStore.applyRefreshedTokens).toHaveBeenCalledWith('at-2', 'rt-2');
    });

    it('a failing store sync never fails the refresh', async () => {
      mockStore.applyRefreshedTokens.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      await expect(
        mockCapturedConfig.setTokens({ accessToken: 'at-3', refreshToken: 'rt-3' }),
      ).resolves.toBeUndefined();
    });

    it('null clears only the in-memory cache', async () => {
      await mockCapturedConfig.setTokens(null);
      expect(mockCapturedConfig.getToken()).toBeNull();
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });
});
