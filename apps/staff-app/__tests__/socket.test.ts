/**
 * The realtime connection recovers from a server-side disconnect (token
 * expiry, a rejected token) with backoff, refreshing the session first — and
 * a connection the server drops right after CONNECT does not reset the backoff.
 */
type Handler = (...args: unknown[]) => void;

const mockSocket = {
  handlers: new Map<string, Handler[]>(),
  anyHandlers: [] as Handler[],
  active: true,
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  on(event: string, h: Handler) {
    mockSocket.handlers.set(event, [...(mockSocket.handlers.get(event) ?? []), h]);
    return mockSocket;
  },
  off: jest.fn(),
  onAny(h: Handler) {
    mockSocket.anyHandlers.push(h);
    return mockSocket;
  },
  emit(event: string, ...args: unknown[]) {
    if (event !== 'connect' && event !== 'disconnect') mockSocket.anyHandlers.forEach((h) => h(event, ...args));
    (mockSocket.handlers.get(event) ?? []).forEach((h) => h(...args));
  },
};

jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocket) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn().mockResolvedValue({}) } }));
jest.mock('../src/store/auth.store', () => {
  const state = { token: 'tok' as string | null };
  return { useAuthStore: { getState: () => state } };
});

import { io } from 'socket.io-client';
import { api } from '../src/lib/api';
import { useAuthStore } from '../src/store/auth.store';
import { subscribe, disconnect } from '../src/lib/socket';

const authState = useAuthStore.getState() as { token: string | null };

/** The server drops us: socket.io will not reconnect by itself. */
function serverDrops() {
  mockSocket.connected = false;
  mockSocket.emit('disconnect', 'io server disconnect');
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSocket.handlers.clear();
  mockSocket.anyHandlers = [];
  mockSocket.connected = false;
  authState.token = 'tok';
  disconnect();
  subscribe('staff:msg', () => {});
});

afterEach(() => {
  disconnect();
  jest.useRealTimers();
});

it('reconnects after a server disconnect, refreshing the session first', async () => {
  expect(io).toHaveBeenCalledTimes(1);
  serverDrops();
  await jest.advanceTimersByTimeAsync(4_999);
  expect(mockSocket.connect).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  expect((api.get as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    mockSocket.connect.mock.invocationCallOrder[0],
  );
});

it('keeps backing off when the server accepts CONNECT and then drops the token', async () => {
  serverDrops();
  await jest.advanceTimersByTimeAsync(5_000);
  expect(mockSocket.connect).toHaveBeenCalledTimes(1);

  // Rejected again right after the handshake.
  mockSocket.emit('connect');
  serverDrops();
  await jest.advanceTimersByTimeAsync(9_999);
  expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(mockSocket.connect).toHaveBeenCalledTimes(2); // 10 s, not 5 s
});

it('resets the backoff once a connection has really held', async () => {
  serverDrops();
  await jest.advanceTimersByTimeAsync(5_000);
  mockSocket.emit('connect');
  await jest.advanceTimersByTimeAsync(10_000); // stayed up
  serverDrops();
  await jest.advanceTimersByTimeAsync(5_000);
  expect(mockSocket.connect).toHaveBeenCalledTimes(2);
});

it('caps the delay at 60 s', async () => {
  for (let i = 0; i < 6; i++) {
    serverDrops();
    await jest.advanceTimersByTimeAsync(60_000);
  }
  // 5, 10, 20, 40, 60, 60
  serverDrops();
  await jest.advanceTimersByTimeAsync(59_999);
  expect(mockSocket.connect).toHaveBeenCalledTimes(6);
  await jest.advanceTimersByTimeAsync(1);
  expect(mockSocket.connect).toHaveBeenCalledTimes(7);
});

it('does not reconnect once signed out', async () => {
  serverDrops();
  authState.token = null;
  disconnect();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(mockSocket.connect).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
});
