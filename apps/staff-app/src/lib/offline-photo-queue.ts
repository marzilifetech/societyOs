import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'staff:photo-queue';

export type PendingPhoto = {
  uri: string;
  phase: 'BEFORE' | 'DURING' | 'AFTER';
  takenAt: string;
  lat?: number;
  lng?: number;
};

type QueueEntry = { taskId: string; photo: PendingPhoto };

export type PhotoUploader = (taskId: string, photo: PendingPhoto) => Promise<void>;

export async function enqueueOffline(photo: PendingPhoto, taskId: string): Promise<void> {
  const raw = (await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) ?? '[]';
  const list: QueueEntry[] = JSON.parse(raw);
  list.push({ taskId, photo });
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(list));
}

export async function drainOfflineQueue(uploader: PhotoUploader): Promise<void> {
  const raw = (await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) ?? '[]';
  const list: QueueEntry[] = JSON.parse(raw);
  if (!list.length) return;
  const remaining: QueueEntry[] = [];
  for (const { taskId, photo } of list) {
    try {
      await uploader(taskId, photo);
    } catch {
      remaining.push({ taskId, photo });
    }
  }
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
}
