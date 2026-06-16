import { api } from './api';

/**
 * Marzi media upload — same path the resident app uses (works) instead of
 * the broken self-signed S3 PUT (returned 403 because the backend's IAM
 * principal lacks PutObject anywhere).
 *
 * Flow:
 *   1. POST /media            → backend mints a Marzi asset + presigned S3 POST
 *   2. POST to S3 (multipart) → file bytes
 *   3. POST /media/:id/confirm → flip asset PENDING → ACTIVE
 *
 * For public assets (profile photos, check-in proofs) Marzi returns a CDN URL
 * we can render directly. For private assets (KYC, salary docs) the response
 * is `public_url: null` and the caller must fetch through Marzi.
 */

export type MediaVisibility = 'public' | 'private';

export type MediaUploadResult = {
  assetId: string;
  publicUrl: string | null;
  s3Key: string;
};

type CreateMediaResponse = {
  asset_id: string;
  s3_key: string;
  public_url: string | null;
  upload: { method: string; url: string; fields: Record<string, string> };
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extensionOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /\.([a-zA-Z0-9]+)(?:[?#].*)?$/.exec(value);
  return match ? match[1].toLowerCase() : undefined;
}

function resolveContentType(uri: string, opts: { contentType?: string; filename?: string }): string {
  if (opts.contentType) return opts.contentType;
  return (
    CONTENT_TYPE_BY_EXT[extensionOf(opts.filename) ?? ''] ??
    CONTENT_TYPE_BY_EXT[extensionOf(uri) ?? ''] ??
    'image/jpeg'
  );
}

export async function uploadViaMedia(
  uri: string,
  opts: { contentType?: string; visibility?: MediaVisibility; filename?: string } = {},
): Promise<MediaUploadResult> {
  const contentType = resolveContentType(uri, opts);
  const visibility = opts.visibility ?? 'public';
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin';
  const filename = opts.filename ?? `upload.${ext}`;

  // 1. Backend mints the Marzi asset.
  const created = await api.post<CreateMediaResponse>('/media', {
    filename,
    content_type: contentType,
    visibility,
  });

  // 2. S3 presigned POST: every signed field BEFORE the file, file LAST.
  const form = new FormData();
  for (const [k, v] of Object.entries(created.upload.fields)) {
    form.append(k, v);
  }
  form.append('file', { uri, name: filename, type: contentType } as any);
  const res = await fetch(created.upload.url, { method: 'POST', body: form });
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
