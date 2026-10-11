import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readNotificationData,
  notificationEntityId,
  notificationType,
  settleWithin,
} from '@societyos/mobile-core';
import type { ApiClient } from '@societyos/api-client';
import { api } from './api';
import { nativeChannelsReady } from './native-notifications';
import { appNavigator } from './navigation';
import { useLockStore } from '../store/lock.store';
import { hrefForNotification, performNotificationAction } from './notification-routes';

/**
 * Legacy AsyncStorage cache of the last registered FCM token. It made
 * registration skip the POST whenever the token was unchanged — which is
 * exactly the case on a shared guard phone when a different guard signs in, so
 * the server kept routing guard A's pushes to the phone guard B now held, and
 * guard B never got their own. Only removed now (see unregisterDeviceToken).
 */
const LEGACY_DEVICE_TOKEN_KEY = 'fcm_device_token';

/** `${userId}:${token}` last confirmed by the server in THIS process. */
let registeredKey: string | null = null;
/** The token most recently obtained, for unregistering at sign-out. */
let lastKnownToken: string | null = null;

// appType the backend expects for device-token routing.
const APP_TYPE = 'staff' as const;

/**
 * The auth store, required lazily: it imports this module (sign-out
 * unregisters the device token), so a top-level import would be a cycle.
 */
function authStore(): (typeof import('../store/auth.store'))['useAuthStore'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store/auth.store').useAuthStore;
}

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
 * POST the device push token to the backend (an upsert: the token moves to
 * whoever is signed in now). Throws on failure so the caller can retry.
 *
 * Deduplicated per user+token in memory only, so every sign-in and every cold
 * start confirms the mapping once — cheap, and self-healing if the server
 * dropped the row (stale-token cleanup) or another account claimed it.
 */
async function postDeviceToken(token: string): Promise<void> {
  const userId = authStore().getState().user?.id;
  if (!userId) return;
  const key = `${userId}:${token}`;
  lastKnownToken = token;
  if (registeredKey === key) return;
  await api.post('/notifications/devices', {
    token,
    platform: Platform.OS,
    appType: APP_TYPE,
  });
  registeredKey = key;
}

/**
 * Forget this device's push token on the server. Best-effort and bounded:
 * sign-out must never hang on it.
 *
 * @param client Sign-out passes a client holding the session it has already
 *   wiped locally (see clientForSession); the default is the live session.
 */
export async function unregisterDeviceToken(
  client: Pick<ApiClient, 'delete'> = api,
): Promise<void> {
  // Forgotten locally FIRST: if the next guard signs in while this call is
  // still out, their registration must not be undone by its cleanup.
  const known = lastKnownToken;
  registeredKey = null;
  lastKnownToken = null;
  try {
    const token =
      known ??
      (await settleWithin(
        Notifications.getDevicePushTokenAsync().then((t) => t.data as unknown as string),
        3000,
        null,
      ));
    if (token) {
      await settleWithin(
        client.delete(`/notifications/devices/${encodeURIComponent(token)}`),
        5000,
        undefined,
      );
    }
  } catch {
    /* best-effort */
  } finally {
    await AsyncStorage.removeItem(LEGACY_DEVICE_TOKEN_KEY).catch(() => undefined);
  }
}

/**
 * Foreground display behaviour. While a session is active, the
 * ForegroundBannerBridge in app/_layout.tsx renders EVERY foreground push as
 * the rich in-app banner, so the OS banner would be a duplicate — suppress
 * it. Logged out or PIN-locked the bridge is off, so keep the OS alert then.
 *
 * shouldSetBadge stays true: the backend sends the recipient's unread
 * NotificationLog count as the badge; the inbox screen clears it on focus.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      let bannerCoversForeground = false;
      try {
        // The in-app banner is off while the PIN lock is up (it drew above
        // the lock, actions included), so the OS banner covers that window.
        bannerCoversForeground = !!authStore().getState().token && !useLockStore.getState().locked;
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

/**
 * Ask for permission if it has never been asked, then register this device's
 * FCM token for the signed-in user. Returns the token, or null when permission
 * is missing or registration failed. Cheap to call repeatedly — a token already
 * confirmed for this user is not re-posted unless `force` is set.
 */
export async function registerForPushNotifications({
  force = false,
}: { force?: boolean } = {}): Promise<string | null> {
  // Skip silently on iOS Simulator — push tokens are not issued there.
  if (!Constants.isDevice) return null;
  if (force) registeredKey = null;
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
    const token = await settleWithin(
      Notifications.getDevicePushTokenAsync().then((t) => t.data as unknown as string),
      10_000,
      null,
    );
    if (!token) return null;

    await postDeviceToken(token);
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] register failed', err);
    return null;
  }
}

/**
 * Re-register when FCM rotates the token. Subscribed while signed in only;
 * the caller owns the subscription.
 */
export function subscribeToTokenRotation(): Notifications.Subscription {
  return Notifications.addPushTokenListener((t) => {
    const next = t.data as unknown as string;
    if (next) postDeviceToken(next).catch(() => {});
  });
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
 * Handle a lockscreen action-button tap (iOS; Android pushes are drawn by the
 * FCM SDK without buttons). Every action is idempotent server-side.
 *
 * Failures surface as a local notification: the app is usually backgrounded
 * when a lockscreen button is tapped, so an in-app alert would never be read.
 * Anything that can fail on a lockscreen and leave no evidence WILL eventually
 * be relied upon and quietly lose work.
 */
async function handleActionButton(actionId: string, data: Record<string, unknown>): Promise<void> {
  const entityId = notificationEntityId(data);
  const group = typeof data.actionGroup === 'string' ? data.actionGroup : undefined;
  if (!entityId) return;
  try {
    // The API needs the stored session; a button can be tapped on a cold start.
    await authStore().getState().hydrate();
    if (!authStore().getState().token) return;
    await performNotificationAction(group, actionId, entityId);
  } catch (err: unknown) {
    if (__DEV__) console.warn('[notifications] action failed', actionId, err);
    await notifyActionFailed(err instanceof Error ? err.message : undefined);
  }
}

async function notifyActionFailed(detail?: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "That didn't go through",
        body: `Your response could not be saved${detail ? ` (${detail})` : ''}. Open the app to try again.`,
        data: { type: 'ACTION_FAILED' },
      },
      trigger: null,
    });
  } catch {
    // A failure to report a failure is not worth crashing over.
  }
}

/**
 * Route one notification response. Shared by the warm-tap listener AND the
 * cold-start path, so a tap that launches a killed app (a guard opening a gate
 * or SOS push) still deep-links instead of just opening Home.
 *
 * Navigation goes through `appNavigator`, which holds it until the tabs are up
 * and the PIN lock is passed: it used to be pushed straight away, which either
 * threw ("navigate before mounting") and was lost, or put the target screen on
 * top of the lock screen, readable without a PIN.
 */
async function handleResponse(resp: Notifications.NotificationResponse): Promise<void> {
  const data = readNotificationData(resp.notification.request.content.data);
  const action = resp.actionIdentifier;

  // Action-button taps short-circuit the default deep-link: the user has
  // already expressed intent on the lockscreen, no need to open a screen.
  if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    await handleActionButton(action, data);
    return;
  }
  // Only route into a signed-in app; a tap that arrives after sign-out points
  // into someone else's session.
  await authStore().getState().hydrate();
  if (!authStore().getState().token) return;
  appNavigator.navigateWhenReady(hrefForNotification(notificationType(data), data));
}

/**
 * Identifier of the last notification response already acted on.
 *
 * `getLastNotificationResponseAsync()` does NOT mean "this launch was caused by
 * a notification tap" — it returns the last response RECORDED ON THE DEVICE,
 * and that value survives app restarts. Without a PERSISTED guard, every cold
 * start deep-links to whatever push the user last tapped, including launches
 * from the home-screen icon.
 */
const HANDLED_RESPONSE_KEY = 'last_handled_notification_response';

async function markResponseHandled(resp: Notifications.NotificationResponse) {
  try {
    await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, resp.notification.request.identifier);
  } catch {
    /* non-fatal — worst case we re-route once */
  }
}

let tapRoutingStarted = false;

/**
 * Start routing notification taps. Called once from the root layout at mount,
 * signed in or not — the cold-start tap must be read before anything else
 * consumes it.
 */
export function setupTapRouting(): Notifications.Subscription {
  if (!tapRoutingStarted) {
    tapRoutingStarted = true;
    Notifications.getLastNotificationResponseAsync()
      .then(async (resp) => {
        if (!resp) return;
        const id = resp.notification.request.identifier;
        const seen = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY).catch(() => null);
        if (seen === id) return; // stale replay of an old tap — ignore
        await markResponseHandled(resp);
        await handleResponse(resp);
      })
      .catch(() => {});
  }
  // Warm taps are recorded too, so the same tap isn't replayed as a "cold
  // start" route on the next launch.
  return Notifications.addNotificationResponseReceivedListener((resp) => {
    void markResponseHandled(resp);
    void handleResponse(resp);
  });
}

/**
 * Foreground receiver — drives the in-app banner. Subscribed while signed in;
 * the caller owns the subscription.
 */
export function subscribeToForegroundReceived(
  cb: (n: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(cb);
}
