import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

// Use Socket<any,any> so .on/.off accept arbitrary event names without
// requiring a fully-typed event map (events come from multiple backend modules)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let socket: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSocket(): any {
  if (!socket) {
    const token = useAuthStore.getState().token;
    const apiUrl = runtimeProcess.process?.env?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
    // Strip /v1 or /api/v1 suffix to get the server root
    const serverUrl = apiUrl.replace(/\/api\/v\d+$/, '').replace(/\/v\d+$/, '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    } as any);
  }
  return socket;
}

export function connectSocket() {
  getSocket().connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
