/**
 * Upload a file through the Marzi media service — the one upload path that
 * works in production (the backend's own presigned S3 PUT is refused: its IAM
 * role cannot write objects). Shared by every admin page that uploads.
 *
 *   1. POST /media             → asset + presigned S3 POST descriptor
 *   2. POST to S3 (multipart)  → the bytes (signed fields first, file last)
 *   3. POST /media/:id/confirm → the asset becomes ACTIVE
 *
 * `private` for anything personal (IDs, contracts, health records): it then
 * has no public URL, and the S3 key is what gets stored.
 */
export interface MediaUploadResult {
  assetId: string;
  publicUrl: string | null;
  s3Key: string;
}

interface CreateMediaResponse {
  asset_id: string;
  s3_key: string;
  public_url: string | null;
  upload: { method: string; url: string; fields: Record<string, string> };
}

/** Anything with the api-client's `post` (the admin or the care-portal client). */
export interface PostClient {
  post<T>(path: string, body?: unknown): Promise<T>;
}

export async function uploadViaMedia(
  client: PostClient,
  file: File,
  visibility: 'public' | 'private' = 'private',
): Promise<MediaUploadResult> {
  const created = await client.post<CreateMediaResponse>('/media', {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    visibility,
  });

  const form = new FormData();
  for (const [k, v] of Object.entries(created.upload.fields)) form.append(k, v);
  form.append('file', file);

  const res = await fetch(created.upload.url, { method: 'POST', body: form });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Upload failed (${res.status})`);
  }

  await client.post(`/media/${created.asset_id}/confirm`, {});
  return { assetId: created.asset_id, publicUrl: created.public_url, s3Key: created.s3_key };
}
