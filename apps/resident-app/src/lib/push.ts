import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api } from './api';

// The native device push token last registered with the backend. The backend
// sends via the Firebase Admin SDK (raw FCM), so it needs the *native* FCM
// registration token — NOT an Expo push token. We guard with AsyncStorage to
// avoid redundant POSTs but always re-register when the token rotates.
const DEVICE_TOKEN_KEY = 'fcm_device_token';

// Android notification channels mirror the backend notification categories.
// The channel id MUST equal the category key — the backend sets the FCM
// android.channelId to the category, so a missing/mismatched channel would
// silently fall back to the default channel (wrong importance/visibility).
type ChannelSpec = {
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
  visibility?: Notifications.AndroidNotificationVisibility;
};

const ANDROID_CHANNELS: ChannelSpec[] = [
  {
    id: 'visitors_gate',
    name: 'Visitor & Gate Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  {
    id: 'deliveries',
    name: 'Deliveries',
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: 'daily_help',
    name: 'Daily Help',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: 'emergency_sos',
    name: 'Emergency & SOS',
    importance: Notifications.AndroidImportance.MAX,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  {
    id: 'default',
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
  },
];

/**
 * Foreground display behaviour. Show banners/alerts even when the app is open
 * so gate/SOS pushes are never silently swallowed.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Create all Android channels. MUST run before requesting the token so the
 * first push lands on the correct channel. No-op on iOS.
 */
export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    ANDROID_CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        importance: c.importance,
        lockscreenVisibility: c.visibility,
        vibrationPattern: [0, 250, 250, 250],
      }),
    ),
  );
}

/**
 * Ensure notification permission is granted. Returns true when granted.
 * Does NOT open settings — callers that want the settings fallback should
 * use {@link openNotificationSettings}.
 */
export async function ensurePermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Open the OS app settings so the user can flip notifications back on. */
export function openNotificationSettings() {
  return Linking.openSettings();
}

/**
 * Register the native FCM device token with the backend. Idempotent: skips the
 * POST when the token is unchanged. Channels + permission must already be set
 * up by the caller. Best-effort — swallows errors (e.g. iOS Simulator has no
 * APNS and getDevicePushTokenAsync throws).
 */
export async function registerDeviceToken(): Promise<void> {
  try {
    const granted = await ensurePermission();
    if (!granted) return;

    // getDevicePushTokenAsync returns the NATIVE token: an FCM registration
    // token on Android, an APNS token on iOS. This is what the Firebase Admin
    // SDK needs (Expo push tokens would be rejected).
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = typeof tokenData.data === 'string' ? tokenData.data : null;
    if (!token) return;

    await postDeviceToken(token);
  } catch {
    /* best-effort — e.g. no APNS on iOS Simulator */
  }
}

async function postDeviceToken(token: string): Promise<void> {
  const stored = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  if (token === stored) return;
  await api.post('/notifications/devices', {
    token,
    platform: Platform.OS as 'ios' | 'android',
    appType: 'resident',
  });
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
}

/**
 * Subscribe to native token rotation and re-register the new token. Returns
 * the subscription so the caller can remove it on unmount.
 */
export function subscribeToTokenRotation(): Notifications.Subscription {
  return Notifications.addPushTokenListener((tokenData) => {
    const token = typeof tokenData.data === 'string' ? tokenData.data : null;
    if (token) {
      postDeviceToken(token).catch(() => {
        /* best-effort */
      });
    }
  });
}

/** Best-effort: tell the backend to forget this device's token on logout. */
export async function unregisterDeviceToken(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (stored) {
      await api.delete(`/notifications/devices/${encodeURIComponent(stored)}`);
    }
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// Tap routing
// ---------------------------------------------------------------------------

type PushData = {
  type?: string;
  visitId?: string;
  [key: string]: unknown;
};

function extractData(response: Notifications.NotificationResponse | null): PushData | null {
  const data = response?.notification.request.content.data;
  if (data && typeof data === 'object') return data as PushData;
  return null;
}

/** Route the app in response to a notification tap. */
function routeFromData(data: PushData | null) {
  if (!data) return;
  switch (data.type) {
    case 'VISITOR_ARRIVAL':
      if (data.visitId) {
        router.push(`/visitor/review/${data.visitId}` as any);
      }
      return;
    case 'SOS':
      router.push('/medical/sos' as any);
      return;
    default:
      router.push('/' as any);
  }
}

/**
 * Wire tap-routing for both warm taps (listener) and the cold-start case
 * (getLastNotificationResponseAsync). Returns the listener subscription.
 */
export function setupTapRouting(): Notifications.Subscription {
  // Cold start: the app was launched by tapping a notification.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => routeFromData(extractData(response)))
    .catch(() => {
      /* ignore */
    });

  // Warm taps while the app is running/backgrounded.
  return Notifications.addNotificationResponseReceivedListener((response) => {
    routeFromData(extractData(response));
  });
}
