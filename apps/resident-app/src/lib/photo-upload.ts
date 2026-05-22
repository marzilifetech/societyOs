import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type PresignResponse = { url: string; key: string };

/**
 * Open the gallery and let the user pick a single photo.
 * Returns the local file URI, or null if cancelled / permission denied.
 */
export async function pickImageFromLibrary(opts?: {
  allowsEditing?: boolean;
  quality?: number;
}): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: opts?.allowsEditing ?? false,
    quality: opts?.quality ?? 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/**
 * Upload a local file URI to S3 via a presigned PUT URL using the raw body
 * (NOT FormData — S3 presigned PUT does not accept multipart).
 */
export async function uploadToPresignedUrl(
  uri: string,
  presignedUrl: string,
  mimeType = 'image/jpeg',
): Promise<void> {
  const blob = await fetch(uri).then((r) => r.blob());
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': mimeType },
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed: ${res.status}`);
  }
}

/**
 * Convenience: ask backend for a presign, then upload, return the storage key.
 */
export async function presignAndUpload(
  uri: string,
  presignPath: string,
  body: Record<string, unknown> = { contentType: 'image/jpeg' },
): Promise<string> {
  const { url, key } = await api.post<PresignResponse>(presignPath, body);
  await uploadToPresignedUrl(uri, url, (body.contentType as string) ?? 'image/jpeg');
  return key;
}
