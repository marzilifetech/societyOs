import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api } from './api';
import { nativeChannelsReady } from './native-notifications';

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

/**
 * Foreground display behaviour. While a session is active, the
 * ForegroundBannerBridge in app/_layout.tsx renders EVERY foreground push as
 * the rich in-app banner, so the OS banner would be a duplicate — suppress
 * it. Logged out the bridge is unmounted, so keep the OS alert as fallback.
 *
 * shouldSetBadge stays true: the backend sends the recipient's unread
 * NotificationLog count as the badge; the inbox screen clears it on focus.
 */
export async function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      let bannerCoversForeground = false;
      try {
        // Lazy import to keep this module free of a load-order dependency on
        // the auth store.
        const { useAuthStore } = await import('../store/auth.store');
        bannerCoversForeground = !!useAuthStore.getState().token;
      } catch {
        /* conservative: keep the OS alert */
      }
      return {
        shouldShowAlert: !bannerCoversForeground,
        shouldShowBanner: !bannerCoversForeground,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
}

/**
 * Android notification channels. The six "primary" channels are the contract
 * the backend routes to via the per-category `channelId` field in
 * backend/src/common/notification/notification-categories.ts:
 *
 *   emergency_sos — MAX, bypasses DND, public lockscreen
 *   approvals     — HIGH (visitor/help/task approvals + approval results)
 *   deliveries    — HIGH
 *   community     — DEFAULT (notices, events, polls, welfare; replaces the
 *                   legacy 'marketing' channel)
 *   payments      — DEFAULT
 *   system        — DEFAULT (account/auth, app updates, misc)
 *
 * The legacy ids below them (marketing, staff_tasks, notices, etc.) are kept
 * as ALIASES so devices that already registered them keep working — Android
 * locks importance once a channel is created, so renaming or dropping them
 * would silently degrade behavior on existing installs.
 *
 * Per-channel sound is intentionally LEFT EMPTY for v1; differentiation comes
 * from importance + vibration patterns. To wire a custom ringtone, drop the
 * file under apps/staff-app/assets/sounds/{name}.mp3, declare it under
 * app.json expo-notifications "sounds", then set `sound: '{name}'` below.
 */
export async function setupAndroidChannels() {
  // Fast path: the Kotlin bridge (plugins/withNativeNotifications.js) already
  // created every channel in Application.onCreate — before JS loaded, and
  // before FCM could deliver the first push. Repeating the work here would be
  // ~14 sequential async bridge round-trips on the login path for a guaranteed
  // no-op (Android ignores importance/vibration changes to existing channels).
  if (nativeChannelsReady) return;

  const PUBLIC = Notifications.AndroidNotificationVisibility.PUBLIC;
  const PRIVATE = Notifications.AndroidNotificationVisibility.PRIVATE;

  // ─── Primary channels — what the backend targets via channelId ──────────
  const emergency: Notifications.NotificationChannelInput = {
    name: 'Emergency Alerts',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 500, 250, 500, 250, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#821A52',
    bypassDnd: true,
  };
  await Notifications.setNotificationChannelAsync('emergency_sos', { ...emergency });
  await Notifications.setNotificationChannelAsync('approvals', {
    name: 'Approvals',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('deliveries', {
    name: 'Deliveries & Visitors',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('community', {
    name: 'Community & Notices',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments & Salary',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('system', {
    name: 'Account & System',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });

  // ─── Legacy aliases — already exist on installed devices ────────────────
  // Importance is locked after channel creation, so we keep these with the
  // SAME importance as the primary channel they map to. The backend no
  // longer targets these names directly but in-flight payloads still land
  // correctly during the rolling deploy.
  await Notifications.setNotificationChannelAsync('marketing', {
    name: 'News & Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('staff_tasks', {
    name: 'Tasks',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('notices', {
    name: 'Notices',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('approval_results', {
    name: 'Approvals',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('notices_urgent', {
    name: 'Urgent Notices',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: PRIVATE,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('sos', { ...emergency });
}

export async function registerForPushNotifications(): Promise<string | null> {
  // Skip silently on iOS Simulator — push tokens are not issued there.
  if (!Constants.isDevice) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      // NOTE: allowCriticalAlerts is deliberately NOT requested. The
      // com.apple.developer.usernotifications.critical-alerts entitlement
      // (Apple-approved, per bundle ID) is not configured in app.json, and
      // requesting .criticalAlert on an unentitled build risks the whole
      // authorization request failing, silently killing iOS push registration.
      // Re-enable here AND in NotificationPrimerModal once the entitlement is
      // granted and declared under ios.entitlements.
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
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

let coldStartRouted = false;

/**
 * Route a single notification-tap response to the right screen (or run its
 * lockscreen action). Shared by the warm-tap listener AND the cold-start path
 * so a killed-state tap (guard taps a gate/SOS push to launch the app) still
 * deep-links instead of just opening Home.
 */
function routeNotificationResponse(resp: Notifications.NotificationResponse) {
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
        case 'visitor_approvals':
        case 'visitors_gate':
        case 'deliveries':
        case 'VISITOR_APPROVAL_REQUEST':
          // Visitor/approval categories -> visitors screen (same routing as
          // the in-app banner and inbox deep links).
          router.push('/visitors' as any);
          break;
        case 'notices':
        case 'notices_urgent':
        case 'community':
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
        case 'staff_help_requests':
        case 'help':
        case 'HELP_REQUEST':
          if (id) router.push(`/help-requests/${id}` as any);
          else router.push('/help-requests' as any);
          break;
      }
    } catch {}
}

/**
 * Identifier of the last notification response already acted on.
 *
 * `getLastNotificationResponseAsync()` does NOT mean "this launch was caused by
 * a notification tap" — it returns the last response RECORDED ON THE DEVICE,
 * and that value survives app restarts. The `coldStartRouted` flag below is
 * module scope, so it resets on every process start and cannot prevent the
 * replay. Without a PERSISTED guard, every cold start deep-links to whatever
 * push the user last tapped, including launches from the home-screen icon.
 */
const HANDLED_RESPONSE_KEY = 'last_handled_notification_response';

/** Remember a response so neither this launch nor any later one re-routes on it. */
async function markResponseHandled(resp: Notifications.NotificationResponse) {
  try {
    await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, resp.notification.request.identifier);
  } catch {
    /* non-fatal — worst case we re-route once */
  }
}

export function attachNotificationTapHandler() {
  if (responseSub) return responseSub;
  // Cold start: a tap that LAUNCHED the app from a killed state is NOT
  // delivered to the listener below — pull it explicitly so a guard tapping a
  // gate/visitor/SOS push to open the app still deep-links to the right screen.
  // Only route responses we have NOT already handled (see above).
  if (!coldStartRouted) {
    coldStartRouted = true;
    Notifications.getLastNotificationResponseAsync()
      .then(async (resp) => {
        if (!resp) return;
        const id = resp.notification.request.identifier;
        const seen = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY).catch(() => null);
        if (seen === id) return; // stale replay of an old tap — ignore
        await markResponseHandled(resp);
        routeNotificationResponse(resp);
      })
      .catch(() => {});
  }
  // Warm taps are recorded too, so the same tap isn't replayed as a "cold
  // start" route on the next launch.
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    void markResponseHandled(resp);
    routeNotificationResponse(resp);
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
