// Photo upload helpers — presigned-URL flow + image compression.
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

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
