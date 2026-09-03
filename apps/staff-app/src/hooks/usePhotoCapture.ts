import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { savePhotoLocally } from '../lib/upload';
import { uploadViaMedia } from '../lib/photo-upload';
import {
  enqueueOffline,
  drainOfflineQueue,
  type PendingPhoto,
} from '../lib/offline-photo-queue';

type UploadResult = {
  successCount: number;
  failedCount: number;
};

/**
 * Upload one task photo.
 *
 * This used to presign an S3 PUT and send the bytes itself. That path is known
 * broken — see the note at the top of `lib/photo-upload.ts`: the backend's IAM
 * principal has no PutObject permission, so every PUT came back 403. Each photo
 * therefore failed, got queued "offline", and retried forever against the same
 * 403 — which is what staff saw as "photo upload failure". The `/media` flow
 * (backend mints the asset, S3 presigned POST, then confirm) is the one the
 * resident app uses and the one that works.
 */
async function uploadPhoto(taskId: string, photo: PendingPhoto): Promise<void> {
  const uploaded = await uploadViaMedia(photo.uri, {
    contentType: 'image/jpeg',
    visibility: 'public',
    filename: `task-${taskId}-${photo.phase}.jpg`,
  });
  await api.post(`/service-requests/${taskId}/photos`, {
    // The confirm endpoint stores whatever key it is given; the Marzi asset's
    // s3Key is the durable pointer, and publicUrl is the CDN URL to render.
    key: uploaded.publicUrl ?? uploaded.s3Key,
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
