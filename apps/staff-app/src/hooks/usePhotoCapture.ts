import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { uploadToPresigned, savePhotoLocally } from '../lib/upload';
import {
  enqueueOffline,
  drainOfflineQueue,
  type PendingPhoto,
} from '../lib/offline-photo-queue';

type UploadResult = {
  successCount: number;
  failedCount: number;
};

async function uploadPhoto(taskId: string, photo: PendingPhoto): Promise<void> {
  const presign = await api.get<{ url: string; key: string }>(
    `/service-requests/${taskId}/photo-upload-url?phase=${photo.phase}`,
  );
  await uploadToPresigned(presign.url, photo.uri, 'image/jpeg');
  await api.post(`/service-requests/${taskId}/photos`, {
    key: presign.key,
    phase: photo.phase,
    lat: photo.lat,
    lng: photo.lng,
    takenAt: photo.takenAt,
  });
}

export function usePhotoCapture(taskId: string) {
  const cameraRef = useRef<any>(null);
  const [batch, setBatch] = useState<PendingPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = (photo: PendingPhoto) => {
    setBatch((b) => [...b, photo]);
  };

  const submit = async (): Promise<UploadResult | null> => {
    if (batch.length === 0) return null;
    setIsSubmitting(true);
    setError(null);
    let successCount = 0;
    const failed: PendingPhoto[] = [];
    for (const photo of batch) {
      try {
        await uploadPhoto(taskId, photo);
        successCount++;
      } catch (e) {
        console.warn('photo upload failed; queueing offline', e);
        try {
          const local = await savePhotoLocally(photo.uri, taskId);
          await enqueueOffline({ ...photo, uri: local }, taskId);
        } catch {
          // best effort
        }
        failed.push(photo);
      }
    }
    setIsSubmitting(false);
    setBatch([]);
    return { successCount, failedCount: failed.length };
  };

  const drain = () => drainOfflineQueue(uploadPhoto).catch(() => {});

  return {
    cameraRef,
    batch,
    capture,
    submit,
    drain,
    isSubmitting,
    error,
    setBatch,
  };
}
