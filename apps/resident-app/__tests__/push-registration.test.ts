/**
 * Device-token ownership when residents share a phone or are signed out.
 *
 * Before: the token POST was skipped whenever the token matched an
 * AsyncStorage cache, and only a successful DELETE cleared it — which a forced
 * sign-out never attempted. The next resident to sign in got no pushes, and
 * the previous one's kept arriving.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ type: 'android', data: 'fcm-1' }),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));
jest.mock('../src/lib/api', () => ({
  api: { post: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
}));
const mockAuth = { token: 'tok' as string | null, user: { id: 'resA' } as { id: string } | null };
jest.mock('../src/store/auth.store', () => ({ useAuthStore: { getState: () => mockAuth } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from '../src/lib/api';
import { registerDeviceToken, unregisterDeviceToken } from '../src/lib/push';

const post = api.post as jest.Mock;
const devicePosts = () => post.mock.calls.filter(([path]) => path === '/notifications/devices');
const releases = () => post.mock.calls.filter(([path]) => path === '/notifications/devices/release');

function signIn(id: string) {
  mockAuth.token = `tok-${id}`;
  mockAuth.user = { id };
}

beforeEach(async () => {
  await unregisterDeviceToken(); // reset module state between tests
  jest.clearAllMocks();
  await AsyncStorage.clear();
  signIn('resA');
});

it('registers once per user+token, and again when another resident signs in', async () => {
  await registerDeviceToken();
  await registerDeviceToken(); // e.g. every sign-in effect run
  expect(devicePosts()).toHaveLength(1);
  expect(devicePosts()[0][1]).toEqual({ token: 'fcm-1', platform: expect.any(String), appType: 'resident' });

  signIn('resB'); // same phone, same FCM token
  await registerDeviceToken();
  expect(devicePosts()).toHaveLength(2);
});

it('ignores the legacy "already registered" cache', async () => {
  await AsyncStorage.setItem('fcm_device_token', 'fcm-1');
  await registerDeviceToken();
  expect(devicePosts()).toHaveLength(1);
});

it('retries a failed registration on the next call', async () => {
  post.mockRejectedValueOnce(new Error('offline'));
  await registerDeviceToken();
  await registerDeviceToken();
  expect(devicePosts()).toHaveLength(2);
});

it('does not register without permission', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
  await registerDeviceToken();
  expect(devicePosts()).toHaveLength(0);
});

it('sign-out releases the token without needing a session, and clears the legacy cache', async () => {
  await registerDeviceToken();
  await AsyncStorage.setItem('fcm_device_token', 'fcm-1');
  mockAuth.token = null; // forced sign-out: the session is already gone
  await unregisterDeviceToken();
  expect(releases()).toEqual([['/notifications/devices/release', { token: 'fcm-1' }]]);
  expect(await AsyncStorage.getItem('fcm_device_token')).toBeNull();
});

it('the same resident signing back in is registered again (the server dropped the row)', async () => {
  await registerDeviceToken();
  await unregisterDeviceToken();
  await registerDeviceToken();
  expect(devicePosts()).toHaveLength(2);
});

it('a registration waits for a release still in flight, so the release cannot delete it', async () => {
  await registerDeviceToken();
  let finishRelease: () => void = () => {};
  post.mockImplementationOnce(
    () => new Promise((resolve) => { finishRelease = () => resolve({}); }),
  );
  const release = unregisterDeviceToken();
  signIn('resB');
  const register = registerDeviceToken();
  await new Promise((r) => setTimeout(r, 0));
  expect(devicePosts()).toHaveLength(1); // only resA's, from before
  finishRelease();
  await Promise.all([release, register]);
  expect(devicePosts()).toHaveLength(2);
  const order = post.mock.calls.map(([path]) => path);
  expect(order.lastIndexOf('/notifications/devices')).toBeGreaterThan(
    order.indexOf('/notifications/devices/release'),
  );
});

it('release never throws, even when the server call fails', async () => {
  await registerDeviceToken();
  post.mockRejectedValueOnce(new Error('offline'));
  await expect(unregisterDeviceToken()).resolves.toBeUndefined();
});

it('release is bounded when the server never answers', async () => {
  await registerDeviceToken();
  jest.useFakeTimers();
  try {
    post.mockReturnValueOnce(new Promise(() => {}));
    const pending = unregisterDeviceToken();
    await jest.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBeUndefined();
  } finally {
    jest.useRealTimers();
  }
});
