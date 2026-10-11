/**
 * Device-token ownership on shared guard phones.
 *
 * Before: the token POST was skipped whenever the token matched an
 * AsyncStorage cache, and sign-out never removed it — so after guard A signed
 * out and guard B signed in on the same phone, the server kept sending A's
 * pushes to the phone and B got none.
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { isDevice: true } }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ type: 'android', data: 'fcm-1' }),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0 },
}));
jest.mock('../src/lib/native-notifications', () => ({ nativeChannelsReady: true }));
jest.mock('../src/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    get: jest.fn(),
    patch: jest.fn(),
  },
  setApiTokens: jest.fn(),
}));
jest.mock('../src/lib/query-client', () => ({ clearQueryCache: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from '../src/lib/api';
import { registerForPushNotifications, unregisterDeviceToken } from '../src/lib/notifications';
import { useAuthStore } from '../src/store/auth.store';

const post = api.post as jest.Mock;
const del = api.delete as jest.Mock;

function signIn(id: string) {
  useAuthStore.setState({
    token: `tok-${id}`,
    user: { id, name: id, phone: '', role: 'STAFF', societyId: 's' },
    isHydrated: true,
  });
}

const devicePosts = () => post.mock.calls.filter(([path]) => path === '/notifications/devices');

beforeEach(async () => {
  jest.clearAllMocks();
  await unregisterDeviceToken(); // reset module state between tests
  jest.clearAllMocks();
});

it('registers once per user+token, and again when a different guard signs in', async () => {
  signIn('guardA');
  await registerForPushNotifications();
  await registerForPushNotifications(); // e.g. every app foreground
  expect(devicePosts()).toHaveLength(1);
  expect(devicePosts()[0][1]).toEqual({ token: 'fcm-1', platform: expect.any(String), appType: 'staff' });

  signIn('guardB'); // same phone, same FCM token
  await registerForPushNotifications();
  expect(devicePosts()).toHaveLength(2);
});

it('ignores the legacy "already registered" cache that blocked re-registration', async () => {
  await AsyncStorage.setItem('fcm_device_token', 'fcm-1');
  signIn('guardB');
  await registerForPushNotifications();
  expect(devicePosts()).toHaveLength(1);
});

it('retries a failed registration on the next call', async () => {
  signIn('guardA');
  post.mockRejectedValueOnce(new Error('offline'));
  await expect(registerForPushNotifications()).resolves.toBeNull();
  await expect(registerForPushNotifications()).resolves.toBe('fcm-1');
  expect(devicePosts()).toHaveLength(2);
});

it('force re-posts even when already registered', async () => {
  signIn('guardA');
  await registerForPushNotifications();
  await registerForPushNotifications({ force: true });
  expect(devicePosts()).toHaveLength(2);
});

it('does not register without permission', async () => {
  signIn('guardA');
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
  await expect(registerForPushNotifications()).resolves.toBeNull();
  expect(devicePosts()).toHaveLength(0);
});

it('unregisters the token at sign-out and clears the legacy cache', async () => {
  signIn('guardA');
  await registerForPushNotifications();
  await AsyncStorage.setItem('fcm_device_token', 'fcm-1');
  await unregisterDeviceToken();
  expect(del).toHaveBeenCalledWith('/notifications/devices/fcm-1');
  expect(await AsyncStorage.getItem('fcm_device_token')).toBeNull();
});

it('unregister never throws, even when the server call fails', async () => {
  signIn('guardA');
  await registerForPushNotifications();
  del.mockRejectedValueOnce(new Error('offline'));
  await expect(unregisterDeviceToken()).resolves.toBeUndefined();
});
