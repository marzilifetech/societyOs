// Photo upload helpers — presigned-URL flow + image compression.
import * as ImageManipulator from 'expo-image-manipulator';
// SDK 54: documentDirectory/getInfoAsync/copyAsync live in the legacy API surface.
import * as FileSystem from 'expo-file-system/legacy';

export type CompressOpts = {
  maxWidth?: number;
  quality?: number;
};

export async function compressImage(
  uri: string,
  opts: CompressOpts = {},
): Promise<string> {
  const { maxWidth = 1200, quality = 0.8 } = opts;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return result.uri;
  } catch (e) {
    console.warn('[upload] compress failed', e);
    return uri;
  }
}

/**
 * The media service's ceilings (its presigned POST enforces them with an S3
 * content-length-range, so anything over fails as "Upload failed (400)").
 * Decimal megabytes: the conservative reading of "1 MB" / "5 MB".
 */
export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_DOCUMENT_BYTES = 5_000_000;

/** Size on disk, or null when it can't be read. */
export async function fileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

const SHRINK_STEPS: CompressOpts[] = [
  { maxWidth: 1600, quality: 0.7 },
  { maxWidth: 1280, quality: 0.6 },
  { maxWidth: 1024, quality: 0.5 },
];

/**
 * JPEG-compress, stepping size and quality down until the file is under
 * `maxBytes`. Resolves with the last attempt and its size (null if unknown);
 * the caller decides what to do if even that is too big.
 */
export async function compressImageUnder(
  uri: string,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<{ uri: string; size: number | null }> {
  let out = { uri, size: null as number | null };
  for (const step of SHRINK_STEPS) {
    // Always from the original: re-compressing a compressed JPEG compounds the loss.
    const compressed = await compressImage(uri, step);
    out = { uri: compressed, size: await fileSize(compressed) };
    if (out.size !== null && out.size <= maxBytes) break;
  }
  return out;
}

export async function uploadToPresigned(
  url: string,
  fileUri: string,
  contentType = 'image/jpeg',
): Promise<void> {
  // Use fetch directly so we PUT the binary; presigned URL handles auth.
  // RN fetch supports {uri} as Blob source.
  const blob = (await (await fetch(fileUri)).blob());
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob as any,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
}

// Persist a captured photo locally for offline queue.
export async function savePhotoLocally(uri: string, taskId: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory}offline-photos/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const dest = `${dir}${taskId}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    console.warn('[upload] savePhotoLocally failed', e);
    return uri;
  }
}
