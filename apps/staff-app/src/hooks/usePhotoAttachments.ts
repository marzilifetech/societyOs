import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { swallow } from '@societyos/mobile-core';
import { ensurePermission } from '../lib/permissions';
import { compressImageUnder } from '../lib/upload';
import { uploadMediaAndGetKey } from '../lib/photo-upload';

/**
 * Taking, keeping and uploading proof photos — one implementation for every
 * capture screen (task start/complete/dispute, housekeeping, laundry, help
 * requests, gate entries). Each of those screens had its own copy, and each
 * copy had the same defects:
 *
 *   - The camera was launched with no permission check and no try/catch. A
 *     guard who had once refused the camera tapped the button and nothing
 *     happened, ever — the rejection was unhandled.
 *   - On low-memory Android phones the OS kills the app while the camera is
 *     open. The photos already taken and the one just shot were lost. Taken
 *     photos are now kept in a draft (by `draftKey`) and the shot that came
 *     back after the restart is recovered with getPendingResultAsync().
 *   - A failed upload retried EVERY photo; already-uploaded ones are now
 *     remembered and skipped.
 */
export interface PhotoAttachments {
  photos: string[];
  /** Opens the camera (asking for permission properly). */
  takePhoto: () => Promise<void>;
  removePhoto: (uri: string) => void;
  /** Uploads every photo not uploaded yet; resolves to their URLs/keys, in order. */
  uploadAll: () => Promise<string[]>;
  /** Forget the draft once the photos have been submitted. */
  clearDraft: () => Promise<void>;
  isFull: boolean;
}

const DRAFT_PREFIX = 'photo-draft:';
/**
 * The draftKey of the hook that has the camera open. getPendingResultAsync()
 * hands the recovered shot to WHOEVER asks first after the restart: task A's
 * proof photo could attach to task B, and the before/after hooks on the
 * housekeeping screen raced for it. Only the hook that launched the camera
 * may take it.
 */
const PENDING_CAPTURE_KEY = 'photo-capture-pending';

export function usePhotoAttachments({
  draftKey,
  max = 5,
  filenamePrefix = 'photo',
}: {
  /** Stable per screen + record, e.g. `task:<id>:after`. */
  draftKey: string;
  max?: number;
  filenamePrefix?: string;
}): PhotoAttachments {
  const [photos, setPhotos] = useState<string[]>([]);
  const uploaded = useRef(new Map<string, string>());
  /** The camera is open from THIS mount; nothing to recover. */
  const capturing = useRef(false);
  const storageKey = DRAFT_PREFIX + draftKey;

  const persist = useCallback(
    (next: string[]) => {
      void swallow(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)));
    },
    [storageKey],
  );

  const add = useCallback(
    async (uri: string) => {
      // Under the media service's 1 MB image limit, or the upload is refused.
      const { uri: compressed } = await compressImageUnder(uri);
      setPhotos((prev) => {
        if (prev.length >= max || prev.includes(compressed)) return prev;
        const next = [...prev, compressed];
        persist(next);
        return next;
      });
    },
    [max, persist],
  );

  // Restore the draft and recover a shot taken just before Android killed us.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // The owner is read in the same first batch as the draft: read later, it
      // could be the claim of a camera this screen has JUST opened.
      const [raw, owner] = await Promise.all([
        swallow(() => AsyncStorage.getItem(storageKey)),
        swallow(() => AsyncStorage.getItem(PENDING_CAPTURE_KEY)),
      ]);
      let restored: string[] = [];
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        restored = Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : [];
      } catch {
        restored = [];
      }
      if (!cancelled && restored.length) setPhotos(restored.slice(0, max));
      // Someone else's shot (or none): leave it for the hook that took it.
      if (cancelled || owner !== draftKey || capturing.current) return;
      const pending = await swallow(() => ImagePicker.getPendingResultAsync());
      await swallow(() => AsyncStorage.removeItem(PENDING_CAPTURE_KEY));
      const asset =
        pending && 'assets' in pending && !pending.canceled ? pending.assets?.[0] : undefined;
      if (!cancelled && asset?.uri) await add(asset.uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, draftKey, max, add]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= max) {
      Alert.alert('Limit reached', `You can add up to ${max} photos.`);
      return;
    }
    const permission = await ensurePermission('camera', {
      blockedMessage: 'Taking proof photos needs the camera.',
    });
    if (!permission.granted) return;
    // Claimed BEFORE the camera opens: Android may kill us while it is up.
    capturing.current = true;
    await swallow(() => AsyncStorage.setItem(PENDING_CAPTURE_KEY, draftKey));
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
        exif: false,
      });
      if (!result.canceled && result.assets[0]?.uri) await add(result.assets[0].uri);
    } catch (e) {
      Alert.alert('Camera unavailable', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      // Came back in this process: nothing pending to recover.
      capturing.current = false;
      void swallow(() => AsyncStorage.removeItem(PENDING_CAPTURE_KEY));
    }
  }, [photos.length, max, add, draftKey]);

  const removePhoto = useCallback(
    (uri: string) => {
      setPhotos((prev) => {
        const next = prev.filter((p) => p !== uri);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const uploadAll = useCallback(async () => {
    const out: string[] = [];
    for (const [i, uri] of photos.entries()) {
      let key = uploaded.current.get(uri);
      if (!key) {
        key = await uploadMediaAndGetKey(uri, {
          contentType: 'image/jpeg',
          filename: `${filenamePrefix}-${Date.now()}-${i}.jpg`,
        });
        uploaded.current.set(uri, key);
      }
      out.push(key);
    }
    return out;
  }, [photos, filenamePrefix]);

  const clearDraft = useCallback(async () => {
    uploaded.current.clear();
    setPhotos([]);
    await swallow(() => AsyncStorage.removeItem(storageKey));
  }, [storageKey]);

  return { photos, takePhoto, removePhoto, uploadAll, clearDraft, isFull: photos.length >= max };
}
