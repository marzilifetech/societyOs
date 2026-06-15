import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api } from './api';

// Last registered FCM token cache. Module-scope was fragile (a logout couldn't
// force a re-register); AsyncStorage means the comparison survives across cold
// starts and only POSTs when the token actually changed.
const DEVICE_TOKEN_KEY = 'fcm_device_token';

let responseSub: Notifications.Subscription | null = null;
let tokenSub: Notifications.Subscription | null = null;

// appType the backend expects for device-token routing.
const APP_TYPE = 'staff' as const;

/**
 * iOS action categories. The identifier MUST match the backend's
 * `data.actionGroup` (mirrored to `aps.category`) so iOS renders the right
 * lockscreen buttons. Android attaches actions on the notification builder
 * (data-only path in backend push.service.ts), so this is iOS-only.
 */
const IOS_CATEGORIES: { identifier: string; actions: Notifications.NotificationAction[] }[] = [
  {
    identifier: 'visitor_approval',
    actions: [
      { identifier: 'APPROVE', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
      {
        identifier: 'REJECT',
        buttonTitle: 'Reject',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ],
  },
  {
    identifier: 'help_request',
    actions: [
      { identifier: 'ACCEPT', buttonTitle: 'Accept', options: { opensAppToForeground: false } },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Decline',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ],
  },
  {
    identifier: 'task_assignment',
    actions: [
      { identifier: 'ACCEPT', buttonTitle: 'Accept', options: { opensAppToForeground: false } },
      {
        identifier: 'REJECT',
        buttonTitle: 'Reject',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ],
  },
];

export async function setupNotificationCategories() {
  if (Platform.OS !== 'ios') return;
  await Promise.all(
    IOS_CATEGORIES.map((c) => Notifications.setNotificationCategoryAsync(c.identifier, c.actions)),
  );
}

/**
 * POST the device push token to the backend. Preferred over the legacy
 * /auth/device-token route — /notifications/devices stores the platform and
 * supports multiple devices per user, and is what push.service.ts reads from.
 */
async function postDeviceToken(token: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (token === stored) return;
    await api.post('/notifications/devices', {
      token,
      platform: Platform.OS,
      appType: APP_TYPE,
    });
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
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

/**
 * Handle a lockscreen action-button tap. Each action is idempotent server-side,
 * so duplicate taps and multi-device fan-out collapse safely. Failures are
 * swallowed — the user can retry from the detail screen.
 */
async function handleActionButton(actionId: string, data: Record<string, any>): Promise<void> {
  const entityId = data.entityId ?? data.visitId ?? data.id;
  if (!entityId) return;
  try {
    if (data.type === 'VISITOR_APPROVAL_REQUEST' || data.actionGroup === 'visitor_approval') {
      await api.post(`/visitors/${entityId}/decision`, {
        action: actionId === 'APPROVE' ? 'APPROVE' : 'REJECT',
      });
      return;
    }
    if (data.actionGroup === 'help_request' || data.type === 'HELP_REQUEST') {
      if (actionId === 'ACCEPT') await api.patch(`/help-requests/${entityId}/accept`, {});
      else if (actionId === 'DECLINE') await api.patch(`/help-requests/${entityId}/decline`, {});
      return;
    }
    if (data.actionGroup === 'task_assignment' || data.type === 'TASK_ASSIGNED') {
      if (actionId === 'ACCEPT') await api.patch(`/tasks/${entityId}/accept`, {});
      else if (actionId === 'REJECT') await api.patch(`/tasks/${entityId}/reject`, {});
      return;
    }
  } catch (err: any) {
    if (__DEV__) console.warn('[notifications] action failed', actionId, err?.message);
  }
}

export function attachNotificationTapHandler() {
  if (responseSub) return responseSub;
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = (resp.notification.request.content.data ?? {}) as Record<string, any>;
    const type = data.type;
    const id = data.id ?? data.entityId;
    const action = resp.actionIdentifier;

    // Action-button taps short-circuit the default deep-link: the user has
    // already expressed intent on the lockscreen, no need to open a screen.
    if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      void handleActionButton(action, data);
      return;
    }
    try {
      switch (type) {
        // Backend notification categories (data.type == category key).
        case 'staff_tasks':
        case 'task':
        case 'TASK_ASSIGNED':
          if (id) router.push(`/tasks/${id}` as any);
          else router.push('/(tabs)/tasks' as any);
          break;
        case 'approval_results':
        case 'VISITOR_APPROVAL_REQUEST':
          // Approval results (e.g. visitor pre-approvals) -> visitors screen.
          router.push('/visitors' as any);
          break;
        case 'notices':
        case 'notices_urgent':
        case 'notice':
        case 'NOTICE_PUBLISHED':
          router.push('/community/notices' as any);
          break;
        case 'emergency_sos':
        case 'sos':
        case 'SOS_TRIGGERED':
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
        case 'HELP_REQUEST':
          if (id) router.push(`/help-requests/${id}` as any);
          else router.push('/help-requests' as any);
          break;
      }
    } catch {}
  });
  return responseSub;
}

/**
 * Foreground receiver — drives the in-app banner. Subscribed once after login,
 * detached on logout via the returned subscription.
 */
export function subscribeToForegroundReceived(
  cb: (n: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(cb);
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
