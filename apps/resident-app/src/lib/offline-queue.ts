import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { api } from './api';

const QUEUE_KEY = 'resident_offline_queue_v1';
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
  if (authBlocked) return { ok: 0, failed: 0, dropped: 0 };
  draining = true;
  let ok = 0;
  let failed = 0;
  let dropped = 0;
  try {
    const q = await readQueue();
    const remaining: QueuedRequest[] = [];
    for (const item of q) {
      if (item.appVersion && item.appVersion !== APP_VERSION) {
        dropped++;
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
        if (e?.status === 401) {
          authBlocked = true;
          remaining.push(item);
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
 * Try to perform a mutation; if offline or request fails, enqueue it.
 * Returns true if performed online, false if queued.
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
        case 'PUT':
          await api.put(req.path, req.body);
          break;
        case 'DELETE':
          await api.delete(req.path);
          break;
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
