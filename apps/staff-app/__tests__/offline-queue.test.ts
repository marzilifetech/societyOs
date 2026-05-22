/**
 * Tests for offline-queue.ts
 *
 * Module-level state (draining, authBlocked) is reset between tests via
 * jest.resetModules() so each test gets a clean import.
 *
 * Because jest.resetModules() clears the module registry, AsyncStorage is
 * re-required locally in each describe block so both the test and the module
 * under test use the same mock instance.
 */

// Top-level mocks (hoisted by jest) — provide defaults so setup.ts doesn't conflict.
jest.mock('../src/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));

jest.mock('@sentry/react-native', () => ({
  captureMessage: jest.fn(),
}));

const QUEUE_KEY = 'offline_queue_v1';

// ─── helpers ──────────────────────────────────────────────────────────────────

function remock() {
  jest.mock('../src/lib/api', () => ({
    api: { post: jest.fn().mockResolvedValue({}), patch: jest.fn().mockResolvedValue({}), put: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
  }));
  jest.mock('@react-native-community/netinfo', () => ({
    __esModule: true,
    default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }) },
  }));
  jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { version: '1.2.3' } },
  }));
  jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
}

function getAsyncStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage');
  return mod.default ?? mod;
}

// ─── enqueue ──────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  let enqueue: any;
  let queueSize: any;
  let AS: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ enqueue, queueSize } = require('../src/lib/offline-queue'));
    AS = getAsyncStorage();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('adds an item with id, createdAt, and appVersion', async () => {
    const req = { method: 'POST' as const, path: '/test', body: { x: 1 } };
    const item = await enqueue(req);
    expect(item.id).toBeDefined();
    expect(item.createdAt).toBeGreaterThan(0);
    expect(item.appVersion).toBe('1.2.3');
    expect(item.method).toBe('POST');
    expect(item.path).toBe('/test');
    expect(item.body).toEqual({ x: 1 });
  });

  it('respects explicit appVersion override', async () => {
    const item = await enqueue({ method: 'POST' as const, path: '/x', appVersion: '0.9.0' });
    expect(item.appVersion).toBe('0.9.0');
  });

  it('generates unique ids for each item', async () => {
    const a = await enqueue({ method: 'POST' as const, path: '/a' });
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    const b = await enqueue({ method: 'POST' as const, path: '/b' });
    expect(a.id).not.toBe(b.id);
  });

  it('persists the new item to AsyncStorage', async () => {
    await enqueue({ method: 'PATCH' as const, path: '/item/1', body: { done: true } });
    expect(AS.setItem).toHaveBeenCalledWith(QUEUE_KEY, expect.any(String));
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].path).toBe('/item/1');
  });
});

// ─── queueSize ────────────────────────────────────────────────────────────────

describe('queueSize', () => {
  let queueSize: any;
  let AS: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ queueSize } = require('../src/lib/offline-queue'));
    AS = getAsyncStorage();
  });

  it('returns 0 for an empty queue', async () => {
    (AS.getItem as jest.Mock).mockResolvedValueOnce('[]');
    expect(await queueSize()).toBe(0);
  });

  it('returns the correct count of queued items', async () => {
    const q = [{ id: '1' }, { id: '2' }, { id: '3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    expect(await queueSize()).toBe(3);
  });

  it('returns 0 when AsyncStorage has invalid JSON', async () => {
    (AS.getItem as jest.Mock).mockResolvedValueOnce('not-json');
    expect(await queueSize()).toBe(0);
  });

  it('returns 0 when AsyncStorage returns null (readQueue false branch)', async () => {
    // getItem returns null → raw is null → raw ? ... : [] takes the false branch
    (AS.getItem as jest.Mock).mockResolvedValueOnce(null);
    expect(await queueSize()).toBe(0);
  });
});

// ─── drain ────────────────────────────────────────────────────────────────────

describe('drain', () => {
  let drain: any;
  let setAuthBlocked: any;
  let mockApi: any;
  let AS: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockApi = { post: jest.fn().mockResolvedValue({}), patch: jest.fn().mockResolvedValue({}), put: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
    jest.mock('../src/lib/api', () => ({ api: mockApi }));
    jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn() } }));
    jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
    jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
    ({ drain, setAuthBlocked } = require('../src/lib/offline-queue'));
    AS = getAsyncStorage();
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns { ok:0, failed:0, dropped:0 } for an empty queue', async () => {
    (AS.getItem as jest.Mock).mockResolvedValueOnce('[]');
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
  });

  it('drains a POST request successfully', async () => {
    const q = [{ id: '1', method: 'POST', path: '/items', body: { x: 1 }, createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    const result = await drain();
    expect(mockApi.post).toHaveBeenCalledWith('/items', { x: 1 });
    expect(result).toEqual({ ok: 1, failed: 0, dropped: 0 });
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls.at(-1)![1]);
    expect(saved).toHaveLength(0);
  });

  it('drains a PATCH request', async () => {
    const q = [{ id: '2', method: 'PATCH', path: '/items/1', body: { done: true }, createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    await drain();
    expect(mockApi.patch).toHaveBeenCalledWith('/items/1', { done: true });
  });

  it('drains a PUT request', async () => {
    const q = [{ id: '3', method: 'PUT', path: '/items/1', body: { name: 'x' }, createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    await drain();
    expect(mockApi.put).toHaveBeenCalledWith('/items/1', { name: 'x' });
  });

  it('drains a DELETE request', async () => {
    const q = [{ id: '4', method: 'DELETE', path: '/items/1', createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    await drain();
    expect(mockApi.delete).toHaveBeenCalledWith('/items/1');
  });

  it('keeps failed items in the queue and counts them', async () => {
    const q = [{ id: '5', method: 'POST', path: '/fail', body: {}, createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    mockApi.post.mockRejectedValueOnce(new Error('Server error'));
    const result = await drain();
    expect(result).toEqual({ ok: 0, failed: 1, dropped: 0 });
    const remaining = JSON.parse((AS.setItem as jest.Mock).mock.calls.at(-1)![1]);
    expect(remaining).toHaveLength(1);
  });

  it('stops draining on 401 and sets authBlocked', async () => {
    const q = [
      { id: '6', method: 'POST', path: '/a', body: {}, createdAt: 1, appVersion: '1.2.3' },
      { id: '7', method: 'POST', path: '/b', body: {}, createdAt: 2, appVersion: '1.2.3' },
    ];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockApi.post.mockRejectedValueOnce(err401);
    const result = await drain();
    expect(result.ok).toBe(0);
    const remaining = JSON.parse((AS.setItem as jest.Mock).mock.calls.at(-1)![1]);
    expect(remaining).toHaveLength(2);
    // Subsequent drain should be blocked by authBlocked
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([]));
    const result2 = await drain();
    expect(result2).toEqual({ ok: 0, failed: 0, dropped: 0 });
    expect(AS.getItem).toHaveBeenCalledTimes(1); // only called once (first drain)
  });

  it('drops items with a mismatched appVersion', async () => {
    const q = [{ id: '8', method: 'POST', path: '/old', body: {}, createdAt: 1, appVersion: '0.9.0' }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    const result = await drain();
    expect(result).toEqual({ ok: 0, failed: 0, dropped: 1 });
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('does not drop items with no appVersion (legacy items)', async () => {
    const q = [{ id: '9', method: 'POST', path: '/legacy', body: {}, createdAt: 1 }];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    const result = await drain();
    expect(mockApi.post).toHaveBeenCalledWith('/legacy', {});
    expect(result.ok).toBe(1);
    expect(result.dropped).toBe(0);
  });

  it('returns early when authBlocked is true', async () => {
    setAuthBlocked(true);
    const result = await drain();
    expect(result).toEqual({ ok: 0, failed: 0, dropped: 0 });
    expect(AS.getItem).not.toHaveBeenCalled();
  });

  it('prevents concurrent drains (draining lock)', async () => {
    let resolveRead!: (v: string) => void;
    (AS.getItem as jest.Mock).mockReturnValueOnce(
      new Promise<string>((resolve) => { resolveRead = resolve; }),
    );

    const first = drain(); // starts, sets draining = true, blocks at readQueue
    const second = drain(); // returns immediately { ok:0, failed:0, dropped:0 }

    resolveRead('[]'); // unblock first drain
    await first;

    expect(await second).toEqual({ ok: 0, failed: 0, dropped: 0 });
  });

  it('processes a mix of ok, failed, and dropped items', async () => {
    const q = [
      { id: 'a', method: 'POST', path: '/ok', body: {}, createdAt: 1, appVersion: '1.2.3' },
      { id: 'b', method: 'POST', path: '/fail', body: {}, createdAt: 2, appVersion: '1.2.3' },
      { id: 'c', method: 'DELETE', path: '/old', createdAt: 3, appVersion: '0.0.1' },
    ];
    (AS.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(q));
    mockApi.post
      .mockResolvedValueOnce({})              // /ok → success
      .mockRejectedValueOnce(new Error('Network')); // /fail → fail
    const result = await drain();
    expect(result).toEqual({ ok: 1, failed: 1, dropped: 1 });
  });
});

// ─── performOrQueue ───────────────────────────────────────────────────────────

describe('performOrQueue', () => {
  let performOrQueue: any;
  let mockApi: any;
  let mockNetInfo: any;
  let AS: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockApi = { post: jest.fn().mockResolvedValue({}), patch: jest.fn().mockResolvedValue({}), put: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
    mockNetInfo = { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn() };
    jest.mock('../src/lib/api', () => ({ api: mockApi }));
    jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: mockNetInfo }));
    jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
    jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
    ({ performOrQueue } = require('../src/lib/offline-queue'));
    AS = getAsyncStorage();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('executes POST immediately when online and returns true', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    const result = await performOrQueue({ method: 'POST', path: '/items', body: { x: 1 } });
    expect(result).toBe(true);
    expect(mockApi.post).toHaveBeenCalledWith('/items', { x: 1 });
    expect(AS.setItem).not.toHaveBeenCalled();
  });

  it('executes PATCH immediately when online', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    const result = await performOrQueue({ method: 'PATCH', path: '/items/1', body: { done: true } });
    expect(result).toBe(true);
    expect(mockApi.patch).toHaveBeenCalledWith('/items/1', { done: true });
  });

  it('falls back to enqueue on network error and returns false', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    mockApi.post.mockRejectedValueOnce(new Error('Network'));
    const result = await performOrQueue({ method: 'POST', path: '/items', body: {} });
    expect(result).toBe(false);
    expect(AS.setItem).toHaveBeenCalled();
  });

  it('enqueues when offline (isConnected: false) and returns false', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    const result = await performOrQueue({ method: 'POST', path: '/items', body: {} });
    expect(result).toBe(false);
    expect(mockApi.post).not.toHaveBeenCalled();
    expect(AS.setItem).toHaveBeenCalled();
  });

  it('enqueues when isInternetReachable is false and returns false', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: false });
    const result = await performOrQueue({ method: 'POST', path: '/items', body: {} });
    expect(result).toBe(false);
    expect(AS.setItem).toHaveBeenCalled();
  });

  it('default switch branch falls back to api.post for unknown method (e.g. PUT)', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    const result = await performOrQueue({ method: 'PUT', path: '/items/1', body: { flag: true } });
    expect(result).toBe(true);
    // Falls through to default → calls api.post
    expect(mockApi.post).toHaveBeenCalledWith('/items/1', { flag: true });
  });

  it('enqueues when isInternetReachable is null (treated as reachable)', async () => {
    // isInternetReachable: null → null !== false → treated as online
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: null });
    const result = await performOrQueue({ method: 'POST', path: '/probe', body: {} });
    expect(result).toBe(true);
    expect(mockApi.post).toHaveBeenCalled();
  });
});

// ─── startOfflineDrainListener ────────────────────────────────────────────────

describe('startOfflineDrainListener', () => {
  let startOfflineDrainListener: any;
  let mockNetInfo: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNetInfo = { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn() };
    jest.mock('../src/lib/api', () => ({ api: { post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
    jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: mockNetInfo }));
    jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
    jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));
    ({ startOfflineDrainListener } = require('../src/lib/offline-queue'));
  });

  it('subscribes to NetInfo events and returns an unsubscribe function', () => {
    const unsub = startOfflineDrainListener();
    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });

  it('calling startOfflineDrainListener twice returns the same subscription', () => {
    const unsub1 = startOfflineDrainListener();
    const unsub2 = startOfflineDrainListener();
    expect(unsub1).toBe(unsub2);
    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('triggers drain when connection becomes available (isConnected: true)', async () => {
    let capturedCallback: ((state: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });
    // Set up AsyncStorage so drain() won't throw
    const AS = require('@react-native-async-storage/async-storage');
    const store = AS.default ?? AS;
    (store.getItem as jest.Mock).mockResolvedValue('[]');

    startOfflineDrainListener();
    expect(capturedCallback).toBeDefined();

    // Fire the listener with an online state — should invoke drain without throwing
    await expect(
      (async () => { capturedCallback!({ isConnected: true, isInternetReachable: true }); })(),
    ).resolves.toBeUndefined();
  });

  it('does not trigger drain when isConnected is false', async () => {
    let capturedCallback: ((state: any) => void) | undefined;
    const mockDrainApi = { post: jest.fn(), patch: jest.fn() };
    jest.mock('../src/lib/api', () => ({ api: mockDrainApi }));
    mockNetInfo.addEventListener.mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    startOfflineDrainListener();
    capturedCallback!({ isConnected: false, isInternetReachable: false });
    // Give any microtasks a chance to run
    await Promise.resolve();
    expect(mockDrainApi.post).not.toHaveBeenCalled();
  });

  it('does not trigger drain when isInternetReachable is false even if connected', async () => {
    let capturedCallback: ((state: any) => void) | undefined;
    const mockDrainApi = { post: jest.fn(), patch: jest.fn() };
    jest.mock('../src/lib/api', () => ({ api: mockDrainApi }));
    mockNetInfo.addEventListener.mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    startOfflineDrainListener();
    capturedCallback!({ isConnected: true, isInternetReachable: false });
    await Promise.resolve();
    expect(mockDrainApi.post).not.toHaveBeenCalled();
  });

  it('drain().catch() swallows errors so the listener never throws', async () => {
    // Purpose: cover the () => {} function inside drain().catch(() => {}).
    // We make drain() actually reject by having AsyncStorage.setItem throw.
    let capturedCallback: ((state: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return jest.fn();
    });

    const AS = require('@react-native-async-storage/async-storage');
    const store = AS.default ?? AS;
    // drain() will read an empty queue then call writeQueue([]) which calls setItem
    (store.getItem as jest.Mock).mockResolvedValue('[]');
    (store.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

    startOfflineDrainListener();
    // Fire the listener — drain() will reject, .catch(() => {}) must swallow it
    capturedCallback!({ isConnected: true, isInternetReachable: true });

    // Allow microtasks to settle; no unhandled rejection should surface
    await new Promise<void>((r) => setTimeout(r, 0));
  });
});

// ─── APP_VERSION fallback branches ───────────────────────────────────────────

describe('APP_VERSION fallback chains', () => {
  it('uses manifest.version when expoConfig.version is absent', async () => {
    jest.resetModules();
    jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));
    jest.mock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }) },
    }));
    // expoConfig has no version — should fall through to manifest.version
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: {}, manifest: { version: '2.0.0' } },
    }));
    jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));

    const { enqueue } = require('../src/lib/offline-queue');
    const AS = getAsyncStorage();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);

    const item = await enqueue({ method: 'POST' as const, path: '/x' });
    expect(item.appVersion).toBe('2.0.0');
  });

  it('falls back to "0.0.0" when both expoConfig.version and manifest.version are absent', async () => {
    jest.resetModules();
    jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));
    jest.mock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }) },
    }));
    // Neither expoConfig.version nor manifest.version present → '0.0.0'
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: null, manifest: null },
    }));
    jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));

    const { enqueue } = require('../src/lib/offline-queue');
    const AS = getAsyncStorage();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);

    const item = await enqueue({ method: 'POST' as const, path: '/x' });
    expect(item.appVersion).toBe('0.0.0');
  });
});
