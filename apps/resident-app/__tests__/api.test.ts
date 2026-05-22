/**
 * Tests for apps/resident-app/src/lib/api.ts
 *
 * api.ts wraps ApiClient with withTimeout and mapError. We mock ApiClient so we
 * can control what errors are thrown and verify the mapping logic.
 */

jest.mock('@societyos/api-client', () => {
  const mockClient = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return { ApiClient: jest.fn(() => mockClient) };
});

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

function getInternals() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../src/lib/api');
  const { ApiClient } = require('@societyos/api-client');
  const mockClientInstance = ApiClient.mock.results[0].value;
  return { api: mod.api, setApiToken: mod.setApiToken, loadApiToken: mod.loadApiToken, mockClientInstance };
}

describe('api — normal responses', () => {
  let api: any;
  let mockClient: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@societyos/api-client', () => {
      const inst = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      return { ApiClient: jest.fn(() => inst) };
    });
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    const apiMod = require('../src/lib/api');
    api = apiMod.api;
    const { ApiClient } = require('@societyos/api-client');
    mockClient = ApiClient.mock.results[0].value;
  });

  it('api.get resolves with data', async () => {
    mockClient.get.mockResolvedValue({ id: 1 });
    expect(await api.get('/items/1')).toEqual({ id: 1 });
  });

  it('api.post resolves with data', async () => {
    mockClient.post.mockResolvedValue({ created: true });
    expect(await api.post('/items', { name: 'x' })).toEqual({ created: true });
  });

  it('api.patch resolves with data', async () => {
    mockClient.patch.mockResolvedValue({ updated: true });
    expect(await api.patch('/items/1', {})).toEqual({ updated: true });
  });

  it('api.put resolves with data', async () => {
    mockClient.put.mockResolvedValue({ replaced: true });
    expect(await api.put('/items/1', {})).toEqual({ replaced: true });
  });

  it('api.delete resolves with data', async () => {
    mockClient.delete.mockResolvedValue(undefined);
    expect(await api.delete('/items/1')).toBeUndefined();
  });
});

describe('withTimeout', () => {
  let api: any;
  let mockClient: any;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.mock('@societyos/api-client', () => {
      const inst = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      return { ApiClient: jest.fn(() => inst) };
    });
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn(),
    }));
    const apiMod = require('../src/lib/api');
    api = apiMod.api;
    const { ApiClient } = require('@societyos/api-client');
    mockClient = ApiClient.mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with timeout message after 15 seconds', async () => {
    mockClient.get.mockImplementation(() => new Promise(() => {})); // never resolves
    const promise = api.get('/slow');
    jest.advanceTimersByTime(15_001);
    await expect(promise).rejects.toThrow('The request is taking longer than expected');
  });

  it('clears timeout when promise resolves before 15 seconds', async () => {
    mockClient.get.mockResolvedValue({ ok: true });
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    await api.get('/fast');
    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears timeout when promise rejects before 15 seconds', async () => {
    mockClient.get.mockRejectedValue(new Error('Network request failed'));
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    await expect(api.get('/fail')).rejects.toThrow();
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('mapError — already-timeout message passthrough', () => {
  let api: any;
  let mockClient: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.mock('@societyos/api-client', () => {
      const inst = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      return { ApiClient: jest.fn(() => inst) };
    });
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn(),
    }));
    const apiMod = require('../src/lib/api');
    api = apiMod.api;
    const { ApiClient } = require('@societyos/api-client');
    mockClient = ApiClient.mock.results[0].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('re-throws timeout errors as-is', async () => {
    const timeoutErr = new Error('The request is taking longer than expected. Please check your connection and try again.');
    mockClient.get.mockRejectedValue(timeoutErr);
    await expect(api.get('/x')).rejects.toThrow('The request is taking longer than expected');
  });

  it('maps TypeError name to network error', async () => {
    const err = new TypeError('network error');
    mockClient.get.mockRejectedValue(err);
    await expect(api.get('/x')).rejects.toThrow('Could not reach the server');
  });

  it('maps "Network request failed" message to network error', async () => {
    mockClient.get.mockRejectedValue(new Error('Network request failed'));
    await expect(api.get('/x')).rejects.toThrow('Could not reach the server');
  });

  it('maps "Failed to fetch" message to network error', async () => {
    mockClient.get.mockRejectedValue(new Error('Failed to fetch'));
    await expect(api.get('/x')).rejects.toThrow('Could not reach the server');
  });

  it('maps "Request failed: 503" to service hiccup message', async () => {
    mockClient.get.mockRejectedValue(new Error('Request failed: 503'));
    await expect(api.get('/x')).rejects.toThrow('Our service had a hiccup');
  });

  it('maps "Request failed: 500" to service hiccup message', async () => {
    mockClient.get.mockRejectedValue(new Error('Request failed: 500'));
    await expect(api.get('/x')).rejects.toThrow('Our service had a hiccup');
  });

  it('does NOT map "Request failed: 422" (4xx) — rethrows original', async () => {
    const err = new Error('Request failed: 422');
    mockClient.get.mockRejectedValue(err);
    await expect(api.get('/x')).rejects.toThrow('Request failed: 422');
  });

  it('re-throws non-Error objects as-is', async () => {
    mockClient.get.mockRejectedValue('plain string error');
    await expect(api.get('/x')).rejects.toBe('plain string error');
  });

  it('re-throws Error with unrecognized message as-is', async () => {
    const err = new Error('Validation failed: email is invalid');
    mockClient.get.mockRejectedValue(err);
    await expect(api.get('/x')).rejects.toBe(err);
  });
});

describe('setApiToken / loadApiToken', () => {
  let setApiToken: any;
  let loadApiToken: any;
  let SecureStore: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@societyos/api-client', () => ({
      ApiClient: jest.fn(() => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() })),
    }));
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue('stored-token'),
      setItemAsync: jest.fn(),
    }));
    const apiMod = require('../src/lib/api');
    setApiToken = apiMod.setApiToken;
    loadApiToken = apiMod.loadApiToken;
    SecureStore = require('expo-secure-store');
  });

  it('setApiToken sets cached token (used by ApiClient getToken)', () => {
    // Can't directly read _cachedToken but we can verify it doesn't throw
    expect(() => setApiToken('my-token')).not.toThrow();
    expect(() => setApiToken(null)).not.toThrow();
  });

  it('loadApiToken reads from SecureStore and sets the cached token', async () => {
    await loadApiToken();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
  });
});

describe('handleUnauthorized (onUnauthorized callback)', () => {
  it('redirects to /login when ApiClient fires onUnauthorized', () => {
    jest.resetModules();
    let capturedOnUnauthorized: (() => void) | undefined;
    jest.mock('@societyos/api-client', () => ({
      ApiClient: jest.fn((opts: any) => {
        capturedOnUnauthorized = opts.onUnauthorized;
        return { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      }),
    }));
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn() }));
    require('../src/lib/api');
    const { router } = require('expo-router');
    capturedOnUnauthorized!();
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

describe('getToken callback', () => {
  it('getToken returns the cached token set by setApiToken', () => {
    jest.resetModules();
    let capturedGetToken: (() => string | null) | undefined;
    jest.mock('@societyos/api-client', () => ({
      ApiClient: jest.fn((opts: any) => {
        capturedGetToken = opts.getToken;
        return { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      }),
    }));
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn() }));
    const { setApiToken } = require('../src/lib/api');
    setApiToken('my-token');
    expect(capturedGetToken!()).toBe('my-token');
  });

  it('getToken returns null before any token is set', () => {
    jest.resetModules();
    let capturedGetToken: (() => string | null) | undefined;
    jest.mock('@societyos/api-client', () => ({
      ApiClient: jest.fn((opts: any) => {
        capturedGetToken = opts.getToken;
        return { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() };
      }),
    }));
    jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
    jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn() }));
    require('../src/lib/api');
    expect(capturedGetToken!()).toBeNull();
  });
});
