import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

/**
 * The app's one realtime connection, to the backend's `/events` namespace.
 *
 * It used to connect to the ROOT namespace, which the server does not serve
 * (EventsGateway authenticates and joins rooms on `/events` only), with the
 * token captured once at creation. Nothing was ever received. Now:
 *   - the access token is read fresh on every (re)connect, so a refreshed
 *     token is used and a signed-out app sends none;
 *   - the server puts the connection in the resident's rooms (society, flat
 *     owner, resident id — see EventsGateway.roomsFor);
 *   - when the server ends the connection (`auth:expired` when the token runs
 *     out, or any server-side disconnect) socket.io does NOT reconnect on its
 *     own, so we do, with backoff — a token the server keeps rejecting must
 *     not turn into a reconnect loop on a phone's data plan.
 *
 * Pushes stay the primary channel for anything urgent; this keeps open
 * screens current without polling.
 */

type Listener = (data: unknown) => void;

const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;
/**
 * How long a connection must last before the backoff resets. The server
 * accepts the handshake and only then rejects a bad or expired token, so a
 * reset on 'connect' kept retrying every 5 s forever.
 */
const STABLE_MS = 10_000;

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let stableTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Make one signed-in request so an expired access token is refreshed (the API
 * client refreshes on a 401) before the socket reconnects with it. Never throws.
 */
async function refreshSessionQuietly(): Promise<void> {
  try {
    // Lazy: api.ts reaches this module through the auth store.
    const { api } = require('./api') as typeof import('./api');
    await api.get('/residents/me');
  } catch {
    /* offline or signed out — the reconnect below copes */
  }
}

function socketUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
  return `${baseUrl.replace(/\/v1\/?$/, '')}/events`;
}

function clearReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

/** Reconnect after the server dropped us, while still signed in. */
function scheduleReconnect(s: Socket): void {
  if (reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (socket !== s || !useAuthStore.getState().token) return;
    void refreshSessionQuietly().then(() => {
      if (socket === s && useAuthStore.getState().token && !s.connected) s.connect();
    });
  }, delay);
}

function ensureSocket(): Socket {
  if (socket) {
    // Created while signed out (rejected, and not retried), or given up on.
    if (!socket.active && useAuthStore.getState().token) socket.connect();
    return socket;
  }
  const s = io(socketUrl(), {
    transports: ['websocket'],
    // A function, so every reconnect reads the CURRENT token.
    auth: (cb) => cb({ token: useAuthStore.getState().token ?? '' }),
    reconnectionDelayMax: 30_000,
  });
  s.on('connect', () => {
    if (stableTimer) clearTimeout(stableTimer);
    stableTimer = setTimeout(() => {
      stableTimer = null;
      reconnectDelay = RECONNECT_BASE_MS;
    }, STABLE_MS);
  });
  s.on('auth:expired', () => scheduleReconnect(s));
  s.on('disconnect', (reason) => {
    if (stableTimer) clearTimeout(stableTimer);
    stableTimer = null;
    if (reason === 'io server disconnect') scheduleReconnect(s);
  });
  socket = s;
  return s;
}

/**
 * The shared connection, already connecting with the current session, for
 * screens that listen to events about one record (e.g. the SOS screen's
 * `sos:<alertId>:acknowledged`). Add listeners with `on` and remove them with
 * `off` on unmount; never connect or disconnect it — sign-out does that.
 */
export function getSocket(): Socket {
  return ensureSocket();
}

/** Listen for a server event while signed in. Returns the unsubscribe. */
export function subscribe(event: string, listener: Listener): () => void {
  if (!useAuthStore.getState().token) return () => {};
  const s = ensureSocket();
  s.on(event, listener);
  return () => {
    s.off(event, listener);
  };
}

/** Drop the connection (sign-out); the next subscribe reconnects with the new session. */
export function disconnect(): void {
  clearReconnect();
  if (stableTimer) clearTimeout(stableTimer);
  stableTimer = null;
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
