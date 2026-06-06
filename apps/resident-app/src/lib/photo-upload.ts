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

// ── Marzi media service (POST /v1/media via our backend proxy) ──────────────

export type MediaVisibility = 'public' | 'private';

export type MediaUploadResult = {
  /** Marzi asset id (ULID). */
  assetId: string;
  /** Public CDN URL — populated for `public` assets, null for `private`. */
  publicUrl: string | null;
  /** S3 object key, e.g. `uploads/private/<uid>/<asset>.jpg`. */
  s3Key: string;
};

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

/** Lower-cased extension from a filename or uri (ignores query strings). */
function extensionOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /\.([a-zA-Z0-9]+)(?:[?#].*)?$/.exec(value);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Resolve the real content type: an explicit value wins, else infer from the
 * filename extension, else the uri extension (expo-image-picker copies the file
 * to a cache uri whose extension matches the source — png stays png), else
 * default to JPEG. Avoids sending every image as image/jpeg.
 */
function resolveContentType(
  uri: string,
  opts: { contentType?: string; filename?: string },
): string {
  if (opts.contentType) return opts.contentType;
  return (
    CONTENT_TYPE_BY_EXT[extensionOf(opts.filename) ?? ''] ??
    CONTENT_TYPE_BY_EXT[extensionOf(uri) ?? ''] ??
    'image/jpeg'
  );
}

type CreateMediaResponse = {
  asset_id: string;
  s3_key: string;
  public_url: string | null;
  upload: { method: string; url: string; fields: Record<string, string> };
};

/**
 * Upload a local file through the Marzi media service (3 steps, all behind our
 * backend `/media` proxy which injects the user's Marzi token):
 *   1. POST /media           → asset + presigned S3 POST target
 *   2. POST to S3 (multipart) → the file bytes
 *   3. POST /media/:id/confirm → flip the asset PENDING → ACTIVE
 *
 * Use `visibility: 'private'` for sensitive documents (KYC, medical) — those
 * return `publicUrl: null` and must be fetched through Marzi; use `'public'`
 * for avatars / visitor / complaint photos that are rendered directly.
 */
export async function uploadViaMedia(
  uri: string,
  opts: { contentType?: string; visibility?: MediaVisibility; filename?: string } = {},
): Promise<MediaUploadResult> {
  const contentType = resolveContentType(uri, opts);
  const visibility = opts.visibility ?? 'public';
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin';
  // Keep the real filename the user picked (e.g. "Screenshot ….png") when we
  // have it; otherwise synthesise one with the correct extension.
  const filename = opts.filename ?? `upload.${ext}`;

  // 1. Create the asset + get the presigned S3 POST descriptor.
  const created = await api.post<CreateMediaResponse>('/media', {
    filename,
    content_type: contentType,
    visibility,
  });

  // 2. Upload straight to S3. For an S3 POST policy every signed form field
  //    must be appended BEFORE the file, and the file field must be LAST.
  const form = new FormData();
  for (const [k, v] of Object.entries(created.upload.fields)) {
    form.append(k, v);
  }
  form.append('file', { uri, name: filename, type: contentType } as any);
  const res = await fetch(created.upload.url, { method: 'POST', body: form });
  // S3 returns 204 No Content (or 201) on success.
  if (!res.ok && res.status !== 204) {
    throw new Error(`Upload failed (${res.status})`);
  }

  // 3. Confirm so Marzi marks the asset ACTIVE.
  await api.post(`/media/${created.asset_id}/confirm`, {});

  return {
    assetId: created.asset_id,
    publicUrl: created.public_url,
    s3Key: created.s3_key,
  };
}
