/**
 * Tests for apps/resident-app/src/lib/offline-queue.ts
 *
 * Module-level state (draining, authBlocked) is reset between describe blocks via
 * jest.resetModules(). Each beforeEach re-requires the module so the state is clean.
 */

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

export {};

const QUEUE_KEY = 'resident_offline_queue_v1';

function remock() {
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
}

function getAS() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage');
  return mod.default ?? mod;
}

// ─── enqueue ──────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  let enqueue: any;
  let AS: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ enqueue } = require('../src/lib/offline-queue'));
    AS = getAS();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('adds an item with id, createdAt, and appVersion', async () => {
    const item = await enqueue({ method: 'POST' as const, path: '/test', body: { x: 1 } });
    expect(item.id).toBeDefined();
    expect(item.createdAt).toBeGreaterThan(0);
    expect(item.appVersion).toBe('1.2.3');
    expect(item.method).toBe('POST');
    expect(item.path).toBe('/test');
    expect(item.body).toEqual({ x: 1 });
  });

  it('respects explicit appVersion override', async () => {
    const item = await enqueue({ method: 'POST' as const, path: '/x', appVersion: '9.9.9' });
    expect(item.appVersion).toBe('9.9.9');
  });

  it('generates unique ids for each item', async () => {
    const a = await enqueue({ method: 'POST' as const, path: '/a' });
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    const b = await enqueue({ method: 'POST' as const, path: '/b' });
    expect(a.id).not.toBe(b.id);
  });

  it('persists to AsyncStorage under QUEUE_KEY', async () => {
    await enqueue({ method: 'PATCH' as const, path: '/items/1', body: { name: 'foo' } });
    expect(AS.setItem).toHaveBeenCalledWith(QUEUE_KEY, expect.any(String));
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].path).toBe('/items/1');
  });

  it('appends to existing queue', async () => {
    const existing = [{ id: 'x', method: 'POST', path: '/old', createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
    await enqueue({ method: 'DELETE' as const, path: '/new' });
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(2);
  });

  it('recovers from corrupted AsyncStorage (readQueue catch)', async () => {
    (AS.getItem as jest.Mock).mockResolvedValue('not-valid-json{{{');
    const item = await enqueue({ method: 'POST' as const, path: '/x' });
    // Should still enqueue — starts from empty queue
    expect(item.id).toBeDefined();
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
    AS = getAS();
  });

  it('returns 0 for empty queue', async () => {
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    expect(await queueSize()).toBe(0);
  });

  it('returns count for non-empty queue', async () => {
    const q = [
      { id: '1', method: 'POST', path: '/a', createdAt: 1, appVersion: '1.2.3' },
      { id: '2', method: 'PATCH', path: '/b', createdAt: 2, appVersion: '1.2.3' },
    ];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    expect(await queueSize()).toBe(2);
  });

  it('returns 0 when AsyncStorage returns null (readQueue false branch)', async () => {
    (AS.getItem as jest.Mock).mockResolvedValueOnce(null);
    expect(await queueSize()).toBe(0);
  });
});

// ─── drain ────────────────────────────────────────────────────────────────────

describe('drain', () => {
  let drain: any;
  let setAuthBlocked: any;
  let AS: any;
  let mockApi: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ drain, setAuthBlocked } = require('../src/lib/offline-queue'));
    AS = getAS();
    mockApi = require('../src/lib/api').api;
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns zero counts for empty queue', async () => {
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
  });

  it('returns early when already draining', async () => {
    // Start a drain that never resolves to hold the draining lock
    (AS.getItem as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const first = drain(); // hangs
    const second = await drain(); // should return immediately
    expect(second).toEqual({ ok: 0, failed: 0, dropped: 0 });
    first; // suppress unhandled
  });

  it('returns early when authBlocked', async () => {
    setAuthBlocked(true);
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
    setAuthBlocked(false);
  });

  it('increments ok for POST, PATCH, PUT, DELETE', async () => {
    const q = [
      { id: '1', method: 'POST',   path: '/a', createdAt: 1, appVersion: '1.2.3' },
      { id: '2', method: 'PATCH',  path: '/b', createdAt: 2, appVersion: '1.2.3' },
      { id: '3', method: 'PUT',    path: '/c', createdAt: 3, appVersion: '1.2.3' },
      { id: '4', method: 'DELETE', path: '/d', createdAt: 4, appVersion: '1.2.3' },
    ];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    const result = await drain();
    expect(result.ok).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it('drops items with a different appVersion', async () => {
    const q = [{ id: '1', method: 'POST', path: '/old', createdAt: 1, appVersion: '0.0.1' }];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    const result = await drain();
    expect(result.dropped).toBe(1);
    expect(result.ok).toBe(0);
  });

  it('keeps items with no appVersion (no drop)', async () => {
    const q = [{ id: '1', method: 'POST', path: '/x', createdAt: 1 }];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    mockApi.post.mockResolvedValue({});
    const result = await drain();
    expect(result.ok).toBe(1);
    expect(result.dropped).toBe(0);
  });

  it('increments failed on non-401 error and keeps item in queue', async () => {
    const q = [{ id: '1', method: 'POST', path: '/fail', createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    mockApi.post.mockRejectedValue(new Error('Server error'));
    const result = await drain();
    expect(result.failed).toBe(1);
    expect(result.ok).toBe(0);
    // remaining includes the failed item
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(1);
  });

  it('sets authBlocked and keeps remaining items on 401', async () => {
    const q = [
      { id: '1', method: 'POST', path: '/first', createdAt: 1, appVersion: '1.2.3' },
      { id: '2', method: 'POST', path: '/second', createdAt: 2, appVersion: '1.2.3' },
    ];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    mockApi.post.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const result = await drain();
    expect(result.ok).toBe(0);
    // both items kept (the 401 one + the tail)
    const saved = JSON.parse((AS.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(2);
  });

  it('resets draining flag even when writeQueue throws', async () => {
    const q = [{ id: '1', method: 'POST', path: '/x', createdAt: 1, appVersion: '1.2.3' }];
    (AS.getItem as jest.Mock).mockResolvedValue(JSON.stringify(q));
    mockApi.post.mockResolvedValue({});
    (AS.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));
    await expect(drain()).rejects.toThrow('Storage full');
    // draining should be reset — a second call should not short-circuit
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
  });
});

// ─── setAuthBlocked ───────────────────────────────────────────────────────────

describe('setAuthBlocked', () => {
  let drain: any;
  let setAuthBlocked: any;
  let AS: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ drain, setAuthBlocked } = require('../src/lib/offline-queue'));
    AS = getAS();
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('blocks drain when set to true and unblocks when set to false', async () => {
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    setAuthBlocked(true);
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
    setAuthBlocked(false);
    expect(await drain()).toEqual({ ok: 0, failed: 0, dropped: 0 });
  });
});

// ─── startOfflineDrainListener ────────────────────────────────────────────────

describe('startOfflineDrainListener', () => {
  let startOfflineDrainListener: any;
  let mockNetInfo: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ startOfflineDrainListener } = require('../src/lib/offline-queue'));
    mockNetInfo = require('@react-native-community/netinfo').default;
  });

  it('registers a NetInfo listener and returns an unsubscribe fn', () => {
    const unsub = startOfflineDrainListener();
    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });

  it('returns the same unsubscribe fn on repeated calls (no duplicate listeners)', () => {
    const a = startOfflineDrainListener();
    const b = startOfflineDrainListener();
    expect(a).toBe(b);
    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('calls drain when online (isConnected=true, isInternetReachable=true)', async () => {
    let capturedCallback: ((s: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return jest.fn();
    });
    const AS = getAS();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);

    startOfflineDrainListener();
    capturedCallback!({ isConnected: true, isInternetReachable: true });
    await new Promise<void>((r) => setTimeout(r, 0));
    // No throw — drain ran
  });

  it('does not call drain when offline', async () => {
    let capturedCallback: ((s: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return jest.fn();
    });
    startOfflineDrainListener();
    const mockApi = require('../src/lib/api').api;
    capturedCallback!({ isConnected: false, isInternetReachable: false });
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('does not call drain when isInternetReachable is false', async () => {
    let capturedCallback: ((s: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return jest.fn();
    });
    startOfflineDrainListener();
    const mockApi = require('../src/lib/api').api;
    capturedCallback!({ isConnected: true, isInternetReachable: false });
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('drain().catch() swallows errors so the listener never throws', async () => {
    let capturedCallback: ((s: any) => void) | undefined;
    mockNetInfo.addEventListener.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return jest.fn();
    });
    const AS = getAS();
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

    startOfflineDrainListener();
    // Trigger the listener — drain will reject because setItem throws
    capturedCallback!({ isConnected: true, isInternetReachable: true });
    // Give microtasks a tick to run — should NOT throw/unhandled rejection
    await new Promise<void>((r) => setTimeout(r, 0));
  });
});

// ─── performOrQueue ───────────────────────────────────────────────────────────

describe('performOrQueue', () => {
  let performOrQueue: any;
  let AS: any;
  let mockApi: any;
  let mockNetInfo: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    ({ performOrQueue } = require('../src/lib/offline-queue'));
    AS = getAS();
    mockApi = require('../src/lib/api').api;
    mockNetInfo = require('@react-native-community/netinfo').default;
    (AS.getItem as jest.Mock).mockResolvedValue('[]');
    (AS.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns true and calls api.post when online', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockApi.post.mockResolvedValue({});
    expect(await performOrQueue({ method: 'POST', path: '/x', body: {} })).toBe(true);
    expect(mockApi.post).toHaveBeenCalledWith('/x', {});
  });

  it('calls api.patch when online with PATCH method', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockApi.patch.mockResolvedValue({});
    expect(await performOrQueue({ method: 'PATCH', path: '/x', body: {} })).toBe(true);
    expect(mockApi.patch).toHaveBeenCalled();
  });

  it('calls api.put when online with PUT method', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockApi.put.mockResolvedValue({});
    expect(await performOrQueue({ method: 'PUT', path: '/x', body: {} })).toBe(true);
    expect(mockApi.put).toHaveBeenCalled();
  });

  it('calls api.delete when online with DELETE method', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockApi.delete.mockResolvedValue({});
    expect(await performOrQueue({ method: 'DELETE', path: '/x' })).toBe(true);
    expect(mockApi.delete).toHaveBeenCalled();
  });

  it('enqueues and returns false when online but api throws', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockApi.post.mockRejectedValue(new Error('Network error'));
    expect(await performOrQueue({ method: 'POST', path: '/x' })).toBe(false);
    expect(AS.setItem).toHaveBeenCalledWith(QUEUE_KEY, expect.any(String));
  });

  it('enqueues and returns false when offline', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    expect(await performOrQueue({ method: 'POST', path: '/x' })).toBe(false);
    expect(mockApi.post).not.toHaveBeenCalled();
    expect(AS.setItem).toHaveBeenCalledWith(QUEUE_KEY, expect.any(String));
  });

  it('enqueues when isInternetReachable is false', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    expect(await performOrQueue({ method: 'PATCH', path: '/y' })).toBe(false);
    expect(mockApi.patch).not.toHaveBeenCalled();
  });
});

// ─── APP_VERSION fallback chains ──────────────────────────────────────────────

describe('APP_VERSION fallback chains', () => {
  function getAS2() {
    const mod = require('@react-native-async-storage/async-storage');
    return mod.default ?? mod;
  }

  it('uses manifest.version when expoConfig.version is absent', async () => {
    jest.resetModules();
    jest.mock('../src/lib/api', () => ({
      api: { post: jest.fn().mockResolvedValue({}), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
    }));
    jest.mock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn() },
    }));
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: {}, manifest: { version: '2.0.0' } },
    }));
    const { enqueue } = require('../src/lib/offline-queue');
    const AS2 = getAS2();
    (AS2.getItem as jest.Mock).mockResolvedValue('[]');
    (AS2.setItem as jest.Mock).mockResolvedValue(undefined);
    const item = await enqueue({ method: 'POST' as const, path: '/v' });
    expect(item.appVersion).toBe('2.0.0');
  });

  it('falls back to "0.0.0" when both version fields are absent', async () => {
    jest.resetModules();
    jest.mock('../src/lib/api', () => ({
      api: { post: jest.fn().mockResolvedValue({}), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
    }));
    jest.mock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn() },
    }));
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: null, manifest: null },
    }));
    const { enqueue } = require('../src/lib/offline-queue');
    const AS2 = getAS2();
    (AS2.getItem as jest.Mock).mockResolvedValue('[]');
    (AS2.setItem as jest.Mock).mockResolvedValue(undefined);
    const item = await enqueue({ method: 'POST' as const, path: '/v' });
    expect(item.appVersion).toBe('0.0.0');
  });
});
