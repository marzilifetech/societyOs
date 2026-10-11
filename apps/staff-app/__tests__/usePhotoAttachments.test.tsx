/**
 * A shot recovered after Android killed the app mid-capture belongs to the
 * screen that opened the camera — not to whichever photo screen mounts next.
 */
jest.mock('expo-image-picker', () => ({
  getPendingResultAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../src/lib/upload', () => ({ compressImageUnder: jest.fn(async (uri: string) => ({ uri, size: 1 })) }));
jest.mock('../src/lib/photo-upload', () => ({ uploadMediaAndGetKey: jest.fn() }));
jest.mock('../src/lib/permissions', () => ({
  ensurePermission: jest.fn().mockResolvedValue({ granted: true, outcome: 'granted' }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePhotoAttachments } from '../src/hooks/usePhotoAttachments';

const pending = ImagePicker.getPendingResultAsync as jest.Mock;
const launch = ImagePicker.launchCameraAsync as jest.Mock;
const PENDING_KEY = 'photo-capture-pending';
const shot = { canceled: false, assets: [{ uri: 'file:///recovered.jpg' }] };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  pending.mockResolvedValue(shot);
});

it("does not take another task's recovered shot", async () => {
  await AsyncStorage.setItem(PENDING_KEY, 'task:A:before');
  const { result } = renderHook(() => usePhotoAttachments({ draftKey: 'task:B:before' }));
  await act(async () => {});
  expect(pending).not.toHaveBeenCalled();
  expect(result.current.photos).toEqual([]);
  // Still there for task A.
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBe('task:A:before');
});

it('recovers the shot into the hook that opened the camera, once', async () => {
  await AsyncStorage.setItem(PENDING_KEY, 'task:A:before');
  const { result } = renderHook(() => usePhotoAttachments({ draftKey: 'task:A:before' }));
  await waitFor(() => expect(result.current.photos).toEqual(['file:///recovered.jpg']));
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
});

it('gives the shot to the right one of two hooks on one screen (before/after)', async () => {
  await AsyncStorage.setItem(PENDING_KEY, 'hk:1:after');
  const { result } = renderHook(() => ({
    before: usePhotoAttachments({ draftKey: 'hk:1:before', max: 1 }),
    after: usePhotoAttachments({ draftKey: 'hk:1:after', max: 1 }),
  }));
  await waitFor(() => expect(result.current.after.photos).toEqual(['file:///recovered.jpg']));
  expect(result.current.before.photos).toEqual([]);
  expect(pending).toHaveBeenCalledTimes(1);
});

it('claims the capture before opening the camera and releases it after', async () => {
  let ownerWhileOpen: string | null = null;
  launch.mockImplementation(async () => {
    ownerWhileOpen = await AsyncStorage.getItem(PENDING_KEY);
    return { canceled: false, assets: [{ uri: 'file:///new.jpg' }] };
  });
  const { result } = renderHook(() => usePhotoAttachments({ draftKey: 'task:A:after' }));
  await act(async () => {
    await result.current.takePhoto();
  });
  expect(ownerWhileOpen).toBe('task:A:after');
  await waitFor(async () => expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull());
  expect(result.current.photos).toEqual(['file:///new.jpg']);
});
