import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';

let registered = false;
let responseSub: Notifications.Subscription | null = null;
let tokenSub: Notifications.Subscription | null = null;

// appType the backend expects for device-token routing.
const APP_TYPE = 'staff' as const;

/**
 * POST the device push token to the backend. Preferred over the legacy
 * /auth/device-token route — /notifications/devices stores the platform and
 * supports multiple devices per user, and is what push.service.ts reads from.
 */
async function postDeviceToken(token: string): Promise<void> {
  try {
    await api.post('/notifications/devices', {
      token,
      platform: Platform.OS,
      appType: APP_TYPE,
    });
  } catch (err: any) {
    if (__DEV__) console.warn('[notifications] register device failed', err?.message);
  }
}

export async function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Android notification channels. Channel id == backend category key so push
 * payloads can target the right channel (push.service.ts sets channel_id to
 * the category). HIGH/MAX importance + PUBLIC lockscreen visibility so staff
 * alerts surface with full content. 'sos' is kept as a legacy alias of the
 * emergency_sos channel.
 */
async function setupAndroidChannels() {
  const PUBLIC = Notifications.AndroidNotificationVisibility.PUBLIC;

  // Routine staff work + notices.
  for (const id of ['staff_tasks', 'notices'] as const) {
    await Notifications.setNotificationChannelAsync(id, {
      name: id === 'staff_tasks' ? 'Tasks' : 'Notices',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: PUBLIC,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Higher-priority categories: approvals + urgent notices + the generic
  // fallback channel.
  await Notifications.setNotificationChannelAsync('approval_results', {
    name: 'Approvals',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('notices_urgent', {
    name: 'Urgent Notices',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
  });

  // SOS / emergency channels — MAX importance, distinct vibration + lights so
  // on-call staff notice even in noisy notification environments. We register
  // both 'emergency_sos' (backend category key) and 'sos' (legacy alias kept
  // for existing payloads). We deliberately do NOT set bypassDnd=true: it
  // requires ACCESS_NOTIFICATION_POLICY plus an explicit user-side DND grant
  // and silently no-ops otherwise.
  const emergency: Notifications.NotificationChannelInput = {
    name: 'Emergency Alerts',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: PUBLIC,
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
  };
  await Notifications.setNotificationChannelAsync('emergency_sos', { ...emergency });
  await Notifications.setNotificationChannelAsync('sos', { ...emergency });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (registered) return null;
  // Skip silently on iOS Simulator — push tokens are not issued there.
  if (!Constants.isDevice) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      // Critical-alerts entitlement (iOS) requires Apple approval against the
      // bundle ID. The request below is harmless without it — iOS just falls
      // back to the standard alert/sound/badge permissions.
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
          allowProvisional: false,
        },
      });
      final = req.status;
    }
    if (final !== 'granted') return null;

    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    // FCM device token. We deliberately do NOT fall back to Expo push tokens:
    // the backend /notifications/devices contract + push.service.ts speak raw
    // FCM, so an Expo token here would be unusable server-side.
    let token: string | null = null;
    try {
      const t = await Notifications.getDevicePushTokenAsync();
      token = t.data as unknown as string;
    } catch {
      token = null;
    }
    if (!token) return null;

    await postDeviceToken(token);
    registered = true;

    // Re-register if FCM rotates the token mid-session.
    if (!tokenSub) {
      tokenSub = Notifications.addPushTokenListener((t) => {
        const next = t.data as unknown as string;
        if (next) postDeviceToken(next).catch(() => {});
      });
    }
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] error', err);
    return null;
  }
}

/** A single notification category preference returned by the backend. */
export interface NotificationPreference {
  key: string;
  label: string;
  description: string;
  importance: string;
  /** false => force-on category; the toggle must be shown as "Always on". */
  mutable: boolean;
  enabled: boolean;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  return api.get<NotificationPreference[]>('/notifications/preferences');
}

export async function updateNotificationPreferences(
  prefs: { category: string; enabled: boolean }[],
): Promise<void> {
  await api.patch('/notifications/preferences', { prefs });
}

export function attachNotificationTapHandler() {
  if (responseSub) return responseSub;
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp.notification.request.content.data ?? {};
    const type = (data as any).type;
    const id = (data as any).id;
    try {
      switch (type) {
        // Backend notification categories (data.type == category key).
        case 'staff_tasks':
        case 'task':
          if (id) router.push(`/tasks/${id}` as any);
          else router.push('/(tabs)/tasks' as any);
          break;
        case 'approval_results':
          // Approval results (e.g. visitor pre-approvals) -> visitors screen.
          router.push('/visitors' as any);
          break;
        case 'notices':
        case 'notices_urgent':
        case 'notice':
          router.push('/community/notices' as any);
          break;
        case 'emergency_sos':
        case 'sos':
          if (id) router.push(`/help-requests/${id}` as any);
          else router.push('/help-requests' as any);
          break;
        // Legacy / app-specific types.
        case 'review':
          router.push('/reviews' as any);
          break;
        case 'leave':
          router.push('/leave/balance' as any);
          break;
        case 'help':
          if (id) router.push(`/help-requests/${id}` as any);
          else router.push('/help-requests' as any);
          break;
      }
    } catch {}
  });
  return responseSub;
}

export function detachNotificationTapHandler() {
  if (responseSub) {
    responseSub.remove();
    responseSub = null;
  }
  if (tokenSub) {
    tokenSub.remove();
    tokenSub = null;
  }
}
