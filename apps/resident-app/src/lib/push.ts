import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  notificationEntityId,
  notificationType,
  readNotificationData,
  settleWithin,
  type NotificationData,
} from '@societyos/mobile-core';
import { api } from './api';
import { appNavigator } from './deferred-navigation';

/** Package name, needed as an extra on the Android settings intents below. */
const applicationId =
  (Constants.expoConfig as { android?: { package?: string } } | null)?.android?.package ??
  'com.marzi.resident';

/**
 * iOS action categories. The id MUST match the backend's `data.actionGroup`
 * (mirrored to `aps.category`) so iOS renders the right buttons. On Android
 * we don't need this — actions are attached to the notification at build time
 * by our data-only handler (see backend push.service.ts and any client-side
 * background notification builder).
 */
const IOS_CATEGORIES: Notifications.NotificationCategory[] = [
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
  // Delivery has the same Approve/Reject buttons PLUS a middle "Leave at
  // security" option that maps to approvalStatus=LEFT_AT_SECURITY server-side.
  // iOS allows up to 4 actions per category — 3 fits cleanly on the lockscreen
  // long-press menu.
  {
    identifier: 'delivery_approval',
    actions: [
      { identifier: 'APPROVE', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
      {
        identifier: 'LEAVE_AT_SECURITY',
        buttonTitle: 'Leave at security',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'REJECT',
        buttonTitle: 'Reject',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ],
  },
];

/**
 * Legacy AsyncStorage cache of the last registered FCM token. Registration
 * skipped the POST whenever the token matched it — exactly the case when a
 * different resident signs in on the same phone, or the server dropped the row
 * at a forced sign-out — and only a successful DELETE ever cleared it, which a
 * forced sign-out never attempted. So the next person got no pushes and the
 * previous one's kept arriving. Only removed now (see unregisterDeviceToken).
 */
const LEGACY_DEVICE_TOKEN_KEY = 'fcm_device_token';

/** `${userId}:${token}` last confirmed by the server in THIS process. */
/** The device-registration POST in flight, if any. */
let registering: Promise<unknown> | null = null;
let registeredKey: string | null = null;
/** The token most recently obtained, for releasing it at sign-out. */
let lastKnownToken: string | null = null;
/** A release still in flight; a registration must wait for it or be deleted by it. */
let releasing: Promise<void> | null = null;

/**
 * The auth store, required lazily: it imports this module (sign-out releases
 * the device token), so a top-level import would be a cycle.
 */
function authStore(): (typeof import('../store/auth.store'))['useAuthStore'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store/auth.store').useAuthStore;
}

// Android notification channels. The six "primary" channels are the contract
// the backend routes to via the per-category `channelId` field in
// backend/src/common/notification/notification-categories.ts:
//
//   emergency_sos — MAX, bypasses DND, public lockscreen
//   approvals     — HIGH (visitor/delivery/help/task approvals + results)
//   deliveries    — HIGH
//   community     — DEFAULT (notices, events, polls, welfare; replaces the
//                   legacy 'marketing' channel)
//   payments      — DEFAULT
//   system        — DEFAULT (account/auth, app updates, misc)
//
// The legacy ids below them (marketing, visitors_gate, daily_help, sos,
// default) are kept as ALIASES so devices that already have those channels
// registered keep working with the same importance/sound — Android locks
// importance once a channel is created, so renaming or dropping them would
// silently degrade behavior on existing installs. New installs get the six
// primary channels under their final names.
//
// Per-channel sound is intentionally LEFT EMPTY for v1: users hear the OS
// default through differentiated importance + distinct vibration patterns.
// To swap in a custom ringtone:
//   1. Drop the file into apps/resident-app/assets/sounds/{name}.mp3
//   2. Reference it in app.json under expo-notifications "sounds"
//   3. Set `sound: '{name}'` (no extension) on the channel below
//   4. expo prebuild + rebuild the APK.
type ChannelSpec = {
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
  visibility?: Notifications.AndroidNotificationVisibility;
  /** Bundled asset filename WITHOUT the .mp3/.wav extension. */
  sound?: string;
  vibrationPattern?: number[];
  enableLights?: boolean;
  /** Notification LED color (brand maroon) — only meaningful with enableLights. */
  lightColor?: string;
  enableVibrate?: boolean;
  /**
   * Attempt to bypass Do Not Disturb. Silently no-ops without the
   * ACCESS_NOTIFICATION_POLICY user grant — used here only as a hint for
   * the emergency channel. Not declared as a manifest permission because
   * granting it is per-device and per-user.
   */
  bypassDnd?: boolean;
};

const ANDROID_CHANNELS: ChannelSpec[] = [
  // ─── Primary channels — what the backend targets via channelId ──────────
  {
    id: 'emergency_sos',
    name: 'Emergency Alerts',
    importance: Notifications.AndroidImportance.MAX,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Long siren-style pattern — unmistakable, keeps buzzing on lockscreen.
    vibrationPattern: [0, 500, 250, 500, 250, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#821A52',
    bypassDnd: true,
  },
  {
    id: 'approvals',
    name: 'Approvals',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Two-pulse pattern — "someone is waiting on your decision".
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  },
  {
    id: 'deliveries',
    name: 'Deliveries & Visitors',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Two-pulse pattern — recognisable as "delivery / visitor at gate".
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  },
  {
    id: 'community',
    name: 'Community & Notices',
    importance: Notifications.AndroidImportance.DEFAULT,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    // Short single buzz — informational, doesn't demand attention.
    vibrationPattern: [0, 200],
    enableVibrate: true,
  },
  {
    // Society broadcasts about water, power or safety. HIGH so they show as a
    // heads-up; on 'community' they arrived silently.
    id: 'notices_urgent',
    name: 'Urgent Notices',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  },
  {
    id: 'payments',
    name: 'Payments & Dues',
    importance: Notifications.AndroidImportance.DEFAULT,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  },
  {
    id: 'system',
    name: 'Account & System',
    importance: Notifications.AndroidImportance.DEFAULT,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  },
  // ─── Legacy aliases — already exist on installed devices ────────────────
  // Importance is locked after a channel is created on a device, so we keep
  // these (identical importance to the primary channel they map to) and the
  // backend stops sending to them after this release. If/when zero devices
  // are on a pre-fix build we can drop these.
  {
    id: 'marketing',
    name: 'News & Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  },
  {
    id: 'visitors_gate',
    name: 'Visitor & Gate Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  },
  {
    id: 'daily_help',
    name: 'Daily Help',
    importance: Notifications.AndroidImportance.DEFAULT,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
    enableVibrate: true,
  },
  {
    id: 'sos',
    name: 'SOS',
    importance: Notifications.AndroidImportance.MAX,
    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 500, 250, 500, 250, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#821A52',
    bypassDnd: true,
  },
  {
    id: 'default',
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    visibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  },
];

/**
 * Foreground display behaviour. While a session is active, the
 * ForegroundBannerBridge in app/_layout.tsx renders EVERY foreground push as
 * the rich in-app banner (deliveries divert to DeliveryApprovalModal), so the
 * OS banner would be a duplicate — suppress it. Logged out the bridge is
 * unmounted, so we keep the OS alert as the fallback surface.
 *
 * shouldSetBadge stays true: the backend sends the recipient's unread
 * NotificationLog count as the badge; the inbox screen clears it on focus.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      let bannerCoversForeground = false;
      try {
        bannerCoversForeground = !!authStore().getState().token;
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
 * Register iOS action categories so the system can render Approve/Reject buttons
 * on the lockscreen and notification center. Safe to call multiple times — Expo
 * dedupes by identifier. No-op on Android.
 */
export async function setupNotificationCategories() {
  if (Platform.OS !== 'ios') return;
  await Promise.all(
    IOS_CATEGORIES.map((c) => Notifications.setNotificationCategoryAsync(c.identifier, c.actions)),
  );
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
        vibrationPattern: c.vibrationPattern,
        enableVibrate: c.enableVibrate,
        enableLights: c.enableLights,
        lightColor: c.lightColor,
        // sound: c.sound — set once we ship custom .mp3 assets. expo-notifications
        // treats `undefined` as "use platform default", which is what we want
        // until then.
        bypassDnd: c.bypassDnd,
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
  // NOTE: allowCriticalAlerts is deliberately NOT requested. The
  // com.apple.developer.usernotifications.critical-alerts entitlement
  // (Apple-approved, per bundle ID) is not configured in app.json, and
  // requesting .criticalAlert on an unentitled build risks the whole
  // authorization request failing — registerDeviceToken() swallows errors,
  // so that would silently kill iOS push registration for fresh installs.
  // Re-enable here once the entitlement is granted and declared under
  // ios.entitlements.
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,
    },
  });
  return status === 'granted';
}

/**
 * Open the OS notification settings for THIS app.
 *
 * `Linking.openSettings()` only reaches the generic App info page, leaving the
 * user to hunt for "Notifications" themselves — the single most common place
 * this flow lost people. On Android we fire the real
 * ACTION_APP_NOTIFICATION_SETTINGS intent so they land on the toggle itself,
 * and fall back to App info if the OEM does not honour it.
 */
export function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    return Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: applicationId },
    ]).catch(() => Linking.openSettings());
  }
  return Linking.openSettings();
}

/**
 * Open the OS settings page for a SINGLE Android channel (e.g. "Emergency
 * Alerts"), where per-channel sound, vibration and DND override live. Falls
 * back to the app-level notification settings.
 */
export function openChannelSettings(channelId: string): Promise<void> {
  if (Platform.OS !== 'android') return openNotificationSettings();
  return Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
    { key: 'android.provider.extra.APP_PACKAGE', value: applicationId },
    { key: 'android.provider.extra.CHANNEL_ID', value: channelId },
  ]).catch(() => openNotificationSettings());
}

/**
 * Register the native FCM device token with the backend. Cheap to repeat: a
 * token already confirmed for this user in this process is not re-posted.
 * Channels + permission must already be set
 * up by the caller. Best-effort — swallows errors (e.g. iOS Simulator has no
 * APNS and getDevicePushTokenAsync throws).
 */
export async function registerDeviceToken(): Promise<void> {
  try {
    // Do NOT request permission here — only register when it is ALREADY
    // granted. The one-shot OS prompt is owned by NotificationOnboarding,
    // which asks right after sign-in and calls this once the user allows.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // getDevicePushTokenAsync returns the NATIVE token: an FCM registration
    // token on Android, an APNS token on iOS. This is what the Firebase Admin
    // SDK needs (Expo push tokens would be rejected).
    const token = await settleWithin(readDevicePushToken(), 10_000, null);
    if (!token) return;

    await postDeviceToken(token);
  } catch {
    /* best-effort — e.g. no APNS on iOS Simulator */
  }
}

async function readDevicePushToken(): Promise<string | null> {
  const tokenData = await Notifications.getDevicePushTokenAsync();
  return typeof tokenData.data === 'string' ? tokenData.data : null;
}

/**
 * POST the device push token (an upsert: the token moves to whoever is signed
 * in now). Throws on failure so the next call retries.
 *
 * Deduplicated per user+token in memory only, so every sign-in and every cold
 * start confirms the mapping once — cheap, and self-healing if the server
 * dropped the row (forced sign-out, stale-token cleanup) or another account
 * on this phone claimed it.
 */
async function postDeviceToken(token: string): Promise<void> {
  const userId = authStore().getState().user?.id;
  if (!userId) return;
  lastKnownToken = token;
  const key = `${userId}:${token}`;
  if (registeredKey === key) return;
  if (releasing) await releasing;
  const post = api.post('/notifications/devices', {
    token,
    platform: Platform.OS as 'ios' | 'android',
    appType: 'resident',
  });
  // Never rejects: it only tells a sign-out when this POST has finished.
  const tracked: Promise<unknown> = post
    .catch(() => undefined)
    .finally(() => {
      if (registering === tracked) registering = null;
    });
  registering = tracked;
  await post;
  // Unless a sign-out released the token while this was in flight.
  if (lastKnownToken === token) registeredKey = key;
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

/**
 * Forget this device's push registration, here and on the server. Called on
 * EVERY sign-out, including a forced one where the session is already dead:
 * `/notifications/devices/release` needs no session, so the previous
 * resident's pushes stop either way.
 *
 * Never throws and is bounded, so sign-out can't hang on it. The in-memory
 * dedupe is dropped at once; a registration made while the release is still
 * in flight waits for it, rather than being deleted by it.
 */
export function unregisterDeviceToken(): Promise<void> {
  registeredKey = null;
  const known = lastKnownToken;
  lastKnownToken = null;
  // A sign-in registration still on its way would land after the release and
  // bind the token to the signed-out user again: let it finish first.
  const pending = registering;
  const run = (async () => {
    try {
      if (pending) await settleWithin(pending, 5000, undefined);
      const token = known ?? (await settleWithin(readDevicePushToken(), 3000, null));
      if (token) {
        await settleWithin(api.post('/notifications/devices/release', { token }), 5000, undefined);
      }
    } catch {
      /* best-effort */
    }
    await AsyncStorage.removeItem(LEGACY_DEVICE_TOKEN_KEY).catch(() => undefined);
  })();
  const tracked: Promise<void> = run.finally(() => {
    if (releasing === tracked) releasing = null;
  });
  releasing = tracked;
  return tracked;
}

// ---------------------------------------------------------------------------
// Tap routing
// ---------------------------------------------------------------------------

/** A push's `data`, as the backend sent it. */
export type PushData = NotificationData;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Where one notification type goes. `undefined` means "not a type this table
 * knows", so the caller can try the next key; `null` means "nowhere" (e.g. a
 * visitor approval without the visit id).
 */
function hrefForType(type: string, data: PushData, id: string | undefined): string | null | undefined {
  // Families of backend event names (SERVICE_REQUEST_CREATED, …_COMPLETED, …).
  if (type.startsWith('SERVICE_REQUEST')) {
    const requestId = str(data.serviceRequestId) ?? id;
    return requestId ? `/services/${requestId}` : '/(tabs)/services';
  }
  if (type.startsWith('AMENITY_BOOKING_')) return '/amenities/bookings';
  if (type.startsWith('HOUSEKEEPING_')) return '/housekeeping';
  if (type.startsWith('EVENT_')) return '/(tabs)/events';

  switch (type) {
    // ── Category registry keys ──────────────────────────────────────────
    case 'visitor_approvals':
    case 'visitors_gate':
      return id ? `/visitor/review/${id}` : null;
    case 'deliveries':
      // A parcel at the gate carries packageId; only a delivery person
      // waiting for a decision is a visit to review.
      if (str(data.packageId)) return '/packages';
      return id ? `/visitor/review/${id}` : '/packages';
    case 'complaints': {
      // Service-request updates are filed under this category too.
      const requestId = str(data.serviceRequestId);
      if (requestId) return `/services/${requestId}`;
      return id ? `/complaints/${id}` : '/complaints';
    }
    case 'service_requests':
      return id ? `/services/${id}` : '/(tabs)/services';
    case 'approval_results':
      return id ? `/visitor/${id}` : '/(tabs)/visitors';
    case 'notices':
    case 'notices_urgent':
    case 'community':
      return '/(tabs)/notices';
    case 'payments':
    case 'payments_dues':
      return '/maintenance';
    case 'emergency_sos':
      return '/medical/sos';
    // ── Backend event names ─────────────────────────────────────────────
    case 'VISITOR_APPROVAL_REQUEST':
      return id ? `/visitor/review/${id}` : null;
    case 'DELIVERY_APPROVAL_REQUEST':
      return id ? `/visitor/review/${id}` : '/packages';
    // Sent at check-in, when there is nothing left to decide: the visit itself.
    case 'VISITOR_ARRIVAL':
    case 'VISITOR_DECISION_RESULT':
      return id ? `/visitor/${id}` : '/(tabs)/visitors';
    case 'PACKAGE_ARRIVED':
    case 'PACKAGE_COLLECTED':
      return '/packages';
    case 'COMPLAINT':
    case 'COMPLAINT_UPDATE':
    case 'COMPLAINT_UPDATED':
      return id ? `/complaints/${id}` : '/complaints';
    case 'BILL_GENERATED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
      return '/maintenance';
    case 'AGM_MEETING_CREATED': {
      const meetingId = str(data.meetingId) ?? id;
      return meetingId ? `/agm/${meetingId}` : '/agm';
    }
    case 'NOTICE_PUBLISHED':
    case 'EMERGENCY_BROADCAST':
      return '/(tabs)/notices';
    case 'ADMIN_PUSH':
      return '/notifications';
    case 'SOS_TRIGGERED':
    case 'SOS':
      return '/medical/sos';
    default:
      return undefined;
  }
}

/**
 * Where tapping a notification takes the resident, or null for nowhere. The
 * ONE routing table: the lockscreen tap, the in-app banner and the inbox all
 * use it (they each had their own copy, and disagreed).
 *
 * `type` is what the caller has: `data.type` for a push, the stored category
 * for an inbox row. The backend event name in `data.type` is the more specific
 * of the two (a service-request update is filed under 'complaints'), so it is
 * tried first. Anything unknown opens the inbox.
 */
export function hrefForNotification(type: string | undefined | null, data: PushData): string | null {
  const id = notificationEntityId(data);
  const specific = notificationType(data);
  for (const key of [specific, type]) {
    if (!key) continue;
    const href = hrefForType(key, data, id);
    if (href !== undefined) return href;
  }
  return '/notifications';
}

/**
 * Route the app in response to a notification tap — only into a signed-in
 * app: a tap that arrives after sign-out points into someone else's session,
 * and held until the tabs are on screen (see deferred-navigation.ts for why a
 * cold-start tap used to be lost).
 */
async function routeFromData(data: PushData): Promise<void> {
  await authStore().getState().hydrate();
  if (!authStore().getState().token) return;
  const href = hrefForNotification(notificationType(data), data);
  if (href) appNavigator.navigateWhenReady(href);
}

/**
 * Handle an action-button tap (Approve/Reject). For VISITOR_APPROVAL_REQUEST
 * we hit the decision endpoint directly so the user doesn't need to open the
 * app. The endpoint is idempotent server-side, so duplicate taps and
 * multi-device fan-out collapse to a no-op.
 */
async function handleAction(actionIdentifier: string, data: PushData): Promise<void> {
  // actionGroup is the canonical signal on current payloads; the type checks
  // cover both the category-registry keys and the legacy event names.
  const type = notificationType(data);
  const isVisitor =
    data.actionGroup === 'visitor_approval' ||
    data.actionGroup === 'delivery_approval' ||
    type === 'visitor_approvals' ||
    type === 'visitors_gate' ||
    type === 'deliveries' ||
    type === 'VISITOR_APPROVAL_REQUEST' ||
    type === 'DELIVERY_APPROVAL_REQUEST';
  if (!isVisitor) return;
  const id = notificationEntityId(data);
  if (!id) return;
  // Maps the lockscreen button identifier to the value the backend's
  // decision endpoint expects. Anything unrecognised falls back to REJECT
  // (the safer default — never let a misfire silently approve a stranger).
  const action =
    actionIdentifier === 'APPROVE'
      ? 'APPROVE'
      : actionIdentifier === 'LEAVE_AT_SECURITY'
      ? 'LEAVE_AT_SECURITY'
      : 'REJECT';
  try {
    // The API needs the stored session; a button can be tapped on a cold start.
    await authStore().getState().hydrate();
    if (!authStore().getState().token) return;
    await api.post(`/visitors/${id}/decision`, { action });
  } catch {
    /* server is the source of truth; user can retry from the visitor screen */
  }
}

/**
 * Identifier of the last notification response we already acted on.
 *
 * `getLastNotificationResponseAsync()` does NOT mean "this launch was caused by
 * a notification tap" — it returns the last response RECORDED ON THE DEVICE,
 * and that value survives app restarts. Without this guard every cold start
 * re-navigates to whatever notification the user last tapped, including
 * launches from the home-screen icon or the Play Store listing.
 */
const HANDLED_RESPONSE_KEY = 'last_handled_notification_response';

/** Remember a response so neither this launch nor any later one re-routes on it. */
async function markResponseHandled(response: Notifications.NotificationResponse) {
  try {
    await AsyncStorage.setItem(
      HANDLED_RESPONSE_KEY,
      response.notification.request.identifier,
    );
  } catch {
    /* non-fatal — worst case we re-route once */
  }
}

/**
 * Wire tap-routing for warm taps + cold start, AND action-button handling.
 * Returns the listener subscription.
 */
export function setupTapRouting(): Notifications.Subscription {
  // Cold start: only route if this response is one we have NOT already acted on.
  Notifications.getLastNotificationResponseAsync()
    .then(async (response) => {
      if (!response) return;

      const id = response.notification.request.identifier;
      const alreadyHandled = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY).catch(
        () => null,
      );
      if (alreadyHandled === id) return; // stale replay of an old tap — ignore
      await markResponseHandled(response);

      const data = readNotificationData(response.notification.request.content.data);
      const action = response.actionIdentifier;
      if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        void handleAction(action, data);
      }
      await routeFromData(data);
    })
    .catch(() => {
      /* ignore */
    });

  // Warm taps while the app is running/backgrounded. Recorded too, so the same
  // tap isn't replayed as a "cold start" route on the next launch.
  return Notifications.addNotificationResponseReceivedListener((response) => {
    void markResponseHandled(response);
    const data = readNotificationData(response.notification.request.content.data);
    const action = response.actionIdentifier;
    if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      void handleAction(action, data);
      return; // action handled; no default route — caller stays where they are
    }
    void routeFromData(data);
  });
}

/**
 * Foreground receiver — fires while the app is visible. The in-app banner
 * subscribes via this; lockscreen / background notifications are rendered by
 * the OS and route through `setupTapRouting`.
 */
export function subscribeToForegroundReceived(
  cb: (n: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(cb);
}
