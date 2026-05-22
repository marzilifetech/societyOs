import { io, Socket } from 'socket.io-client';

type Listener = (data: any) => void;

let socket: Socket | null = null;
const listeners: Record<string, Set<Listener>> = {};

function ensureSocket(token: string | null) {
  if (socket) return socket;
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  const url = baseUrl.replace(/\/v1\/?$/, '');
  try {
    socket = io(url, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      autoConnect: true,
    });
  } catch (e) {
    console.warn('[socket] failed to connect', (e as any)?.message);
    return null;
  }
  return socket;
}

export function subscribe(event: string, listener: Listener, token: string | null = null) {
  const s = ensureSocket(token);
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(listener);

  if (s) {
    const handler = (data: any) => listener(data);
    s.on(event, handler);
    return () => {
      try { s.off(event, handler); } catch {}
      listeners[event]?.delete(listener);
    };
  }
  return () => {
    listeners[event]?.delete(listener);
  };
}

export function disconnect() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
}
