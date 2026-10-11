import { io, type Socket } from 'socket.io-client';
import { swallow } from '@societyos/mobile-core';
import { useAuthStore } from '../store/auth.store';
import { api } from './api';

/**
 * The app's one realtime connection, to the backend's `/events` namespace.
 *
 * It used to connect to the ROOT namespace (the server only serves `/events`),
 * with no token unless the first caller happened to pass one (the server drops
 * token-less sockets), and listened for event names that are really ROOM names
 * (`staff:msg:<group>`). Nothing was ever received. Now:
 *   - the access token is read fresh on every (re)connect, so a refreshed
 *     token is used and a signed-out app sends none;
 *   - the server puts the connection in the right rooms (by role, staff id and
 *     chat groups — see EventsGateway.roomsFor);
 *   - listeners subscribe to the server's EVENT names and filter by payload;
 *   - when the server ends the connection (`auth:expired` when the token runs
 *     out, a token it rejects, or any server-side disconnect) socket.io does
 *     NOT reconnect on its own, so we do — with backoff, and after giving the
 *     api client a chance to refresh the token, so we don't just offer the
 *     server the same expired one again.
 *
 * Pushes stay the primary channel for anything urgent; this keeps open
 * screens current without polling.
 */

type Listener = (data: unknown) => void;

const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;
/**
 * How long a connection must stay up before it counts as accepted. The server
 * authenticates AFTER socket.io's CONNECT, so a rejected token shows up as
 * 'connect' then 'disconnect'; resetting the backoff on 'connect' kept it at
 * 5 s forever — a handshake every few seconds on an idle screen.
 */
const HEALTHY_AFTER_MS = 10_000;

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let healthyTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_BASE_MS;

function socketUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
  return `${baseUrl.replace(/\/v1\/?$/, '')}/events`;
}

function clearTimers(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthyTimer) clearTimeout(healthyTimer);
  reconnectTimer = null;
  healthyTimer = null;
}

/** The server has really accepted us: the next drop starts from the base delay. */
function markHealthy(): void {
  if (healthyTimer) clearTimeout(healthyTimer);
  healthyTimer = null;
  reconnectDelay = RECONNECT_BASE_MS;
}

/**
 * One cheap authenticated call. If the access token has expired, the api
 * client's 401 → refresh path rotates it, and persistTokens puts the new one
 * in the auth store, where the socket's `auth` callback reads it. If the
 * refresh is refused, that path signs out, which disconnects us.
 */
async function refreshSession(): Promise<void> {
  await swallow(() => api.get('/notifications/unread-count'));
}

/** Reconnect after the server dropped us, while still signed in. */
function scheduleReconnect(s: Socket): void {
  if (reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (socket !== s || !useAuthStore.getState().token) return;
    void refreshSession().then(() => {
      // Signed out, replaced or already back while the refresh ran.
      if (socket !== s || !useAuthStore.getState().token || s.connected) return;
      s.connect();
    });
  }, delay);
}

function ensureSocket(): Socket | null {
  if (socket) {
    // Created while signed out (rejected, and not retried), or given up on.
    if (!socket.active && !reconnectTimer && useAuthStore.getState().token) socket.connect();
    return socket;
  }
  try {
    const s = io(socketUrl(), {
      transports: ['websocket'],
      // A function, so every reconnect reads the CURRENT token.
      auth: (cb) => cb({ token: useAuthStore.getState().token ?? '' }),
      reconnectionDelayMax: 30_000,
    });
    s.on('connect', () => {
      if (healthyTimer) clearTimeout(healthyTimer);
      healthyTimer = setTimeout(markHealthy, HEALTHY_AFTER_MS);
    });
    // A real event proves the server accepted us, whatever the clock says.
    s.onAny((event: string) => {
      if (event !== 'auth:expired') markHealthy();
    });
    s.on('auth:expired', () => scheduleReconnect(s));
    s.on('disconnect', (reason) => {
      if (healthyTimer) clearTimeout(healthyTimer);
      healthyTimer = null;
      if (reason === 'io server disconnect' && useAuthStore.getState().token) scheduleReconnect(s);
    });
    socket = s;
  } catch (e) {
    if (__DEV__) console.warn('[socket] failed to connect', (e as Error)?.message);
    socket = null;
  }
  return socket;
}

/** Listen for a server event while signed in. Returns the unsubscribe. */
export function subscribe(event: string, listener: Listener): () => void {
  if (!useAuthStore.getState().token) return () => {};
  const s = ensureSocket();
  if (!s) return () => {};
  s.on(event, listener);
  return () => {
    s.off(event, listener);
  };
}

/** Drop the connection (sign-out); the next subscribe reconnects with the new session. */
export function disconnect(): void {
  clearTimers();
  reconnectDelay = RECONNECT_BASE_MS;
  if (!socket) return;
  const s = socket;
  socket = null;
  try {
    s.disconnect();
  } catch {
    /* already gone */
  }
}
