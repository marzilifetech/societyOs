import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { api } from './api';

const QUEUE_KEY = 'offline_queue_v1';
const APP_VERSION =
  (Constants?.expoConfig?.version as string | undefined) ??
  (Constants?.manifest as { version?: string } | undefined)?.version ??
  '0.0.0';

export type QueuedMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface QueuedRequest {
  id: string;
  method: QueuedMethod;
  path: string;
  body?: unknown;
  createdAt: number;
  // O5: app-version stamp; mismatched payloads dropped on resume.
  appVersion?: string;
}

let authBlocked = false;
export function setAuthBlocked(v: boolean) {
  authBlocked = v;
}

let draining = false;
let unsubscribe: (() => void) | null = null;

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedRequest[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<QueuedRequest> {
  const item: QueuedRequest = {
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    appVersion: req.appVersion ?? APP_VERSION,
  };
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
  return item;
}

export async function drain(): Promise<{ ok: number; failed: number; dropped: number }> {
  if (draining) return { ok: 0, failed: 0, dropped: 0 };
  // O4: don't drain when auth is blocked (e.g. cached 401 — wait for re-auth).
  if (authBlocked) return { ok: 0, failed: 0, dropped: 0 };
  draining = true;
  let ok = 0;
  let failed = 0;
  let dropped = 0;
  try {
    const q = await readQueue();
    const remaining: QueuedRequest[] = [];
    for (const item of q) {
      // O5: drop payloads queued by a different (older) app version.
      if (item.appVersion && item.appVersion !== APP_VERSION) {
        dropped++;
        try {
          // best-effort breadcrumb; Sentry may not be configured yet at module import.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Sentry = require('@sentry/react-native');
          Sentry?.captureMessage?.('offline-queue: dropped mismatched-version item', {
            level: 'warning',
            tags: { from: item.appVersion, current: APP_VERSION },
          });
        } catch {
          /* ignore */
        }
        continue;
      }
      try {
        switch (item.method) {
          case 'POST':
            await api.post(item.path, item.body);
            break;
          case 'PATCH':
            await api.patch(item.path, item.body);
            break;
          case 'PUT':
            await api.put(item.path, item.body);
            break;
          case 'DELETE':
            await api.delete(item.path);
            break;
        }
        ok++;
      } catch (e: any) {
        // O4: stop drain on 401 — payloads stay queued until re-auth.
        if (e?.status === 401) {
          authBlocked = true;
          remaining.push(item);
          // keep remaining queue intact
          for (const tail of q.slice(q.indexOf(item) + 1)) remaining.push(tail);
          break;
        }
        failed++;
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
  } finally {
    draining = false;
  }
  return { ok, failed, dropped };
}

export function startOfflineDrainListener() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      drain().catch(() => {});
    }
  });
  return unsubscribe;
}

export async function queueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

/**
 * Try to perform a mutation; if offline, enqueue it.
 * Returns true if it was performed online, false if queued.
 */
export async function performOrQueue(req: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected && state.isInternetReachable !== false) {
    try {
      switch (req.method) {
        case 'POST':
          await api.post(req.path, req.body);
          break;
        case 'PATCH':
          await api.patch(req.path, req.body);
          break;
        default:
          await api.post(req.path, req.body);
      }
      return true;
    } catch {
      await enqueue(req);
      return false;
    }
  }
  await enqueue(req);
  return false;
}
