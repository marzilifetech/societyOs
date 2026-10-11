/**
 * Tests for apps/resident-app/src/lib/socket.ts
 *
 * The connection must reach the `/events` namespace (the only one the server
 * authenticates), send the CURRENT token on every (re)connect, and come back
 * after the server ends it — socket.io does not reconnect on its own then.
 */

type Handler = (...args: unknown[]) => void;

const mockHandlers: Record<string, Handler[]> = {};
const mockSocketInstance = {
  active: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn((event: string, h: Handler) => {
    (mockHandlers[event] ??= []).push(h);
  }),
  off: jest.fn(),
};

const mockIo = jest.fn((..._args: unknown[]) => mockSocketInstance);
jest.mock('socket.io-client', () => ({ io: (...args: unknown[]) => mockIo(...args) }));

const mockAuth = { token: 'tok-1' as string | null };
jest.mock('../src/store/auth.store', () => ({ useAuthStore: { getState: () => mockAuth } }));
const mockApiGet = jest.fn(() => Promise.resolve({}));
jest.mock('../src/lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...(a as [])) } }));

/** Let the pre-reconnect session refresh settle. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

import { disconnect, getSocket, subscribe } from '../src/lib/socket';

function emit(event: string, ...args: unknown[]) {
  (mockHandlers[event] ?? []).forEach((h) => h(...args));
}

describe('socket', () => {
  beforeEach(() => {
    disconnect();
    jest.clearAllMocks();
    for (const k of Object.keys(mockHandlers)) delete mockHandlers[k];
    mockAuth.token = 'tok-1';
    mockSocketInstance.active = true;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('connects to the /events namespace of the API host', () => {
    subscribe('visitor:arrived', jest.fn());
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockIo.mock.calls[0][0]).toMatch(/\/events$/);
    expect(mockIo.mock.calls[0][0]).not.toMatch(/\/v1\//);
  });

  it('reads the token at every (re)connect, not once', () => {
    subscribe('visitor:arrived', jest.fn());
    const { auth } = mockIo.mock.calls[0][1] as { auth: (cb: (d: unknown) => void) => void };
    const cb = jest.fn();
    auth(cb);
    mockAuth.token = 'tok-2';
    auth(cb);
    expect(cb.mock.calls).toEqual([[{ token: 'tok-1' }], [{ token: 'tok-2' }]]);
  });

  it('shares one connection between subscribers and getSocket()', () => {
    subscribe('a', jest.fn());
    subscribe('b', jest.fn());
    expect(getSocket()).toBe(mockSocketInstance);
    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('does not connect while signed out', () => {
    mockAuth.token = null;
    const unsubscribe = subscribe('a', jest.fn());
    expect(mockIo).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('unsubscribe removes exactly that listener', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe('package:arrived', listener);
    unsubscribe();
    expect(mockSocketInstance.off).toHaveBeenCalledWith('package:arrived', listener);
  });

  it('reconnects after the server ends the connection, refreshing the session first, with backoff', async () => {
    subscribe('a', jest.fn());
    emit('disconnect', 'io server disconnect');
    expect(mockSocketInstance.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5_000);
    await settle();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1);

    // Rejected again: the next try waits longer.
    emit('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(5_000);
    await settle();
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5_000);
    await settle();
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(2);
  });

  it('does not reset the backoff when the server accepts then rejects the handshake', async () => {
    subscribe('a', jest.fn());
    emit('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(5_000);
    await settle();
    // The server rejects a bad token AFTER the connect event.
    emit('connect');
    emit('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(5_000);
    await settle();
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1); // still waiting: 10 s now
  });

  it('reconnects after auth:expired, once', async () => {
    subscribe('a', jest.fn());
    emit('auth:expired', { code: 'TOKEN_EXPIRED' });
    emit('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(60_000);
    await settle();
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1);
  });

  it('leaves client-side drops to socket.io', () => {
    subscribe('a', jest.fn());
    emit('disconnect', 'transport close');
    jest.advanceTimersByTime(60_000);
    expect(mockSocketInstance.connect).not.toHaveBeenCalled();
  });

  it('sign-out disconnects, cancels a pending reconnect, and the next subscribe starts fresh', () => {
    subscribe('a', jest.fn());
    emit('disconnect', 'io server disconnect');
    disconnect();
    expect(mockSocketInstance.disconnect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(mockSocketInstance.connect).not.toHaveBeenCalled();

    subscribe('a', jest.fn());
    expect(mockIo).toHaveBeenCalledTimes(2);
  });

  it('disconnect before any connection is a no-op', () => {
    expect(() => disconnect()).not.toThrow();
  });
});
