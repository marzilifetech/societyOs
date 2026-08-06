import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { api } from './api';

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

// The native device push token last registered with the backend. The backend
// sends via the Firebase Admin SDK (raw FCM), so it needs the *native* FCM
// registration token — NOT an Expo push token. We guard with AsyncStorage to
// avoid redundant POSTs but always re-register when the token rotates.
const DEVICE_TOKEN_KEY = 'fcm_device_token';

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
        // Lazy import — auth.store statically imports this module (logout →
        // unregisterDeviceToken), so a static import here would be a cycle.
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
  // Re-enable here AND in NotificationPrimerModal once the entitlement is
  // granted and declared under ios.entitlements.
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
    // Do NOT request permission here — only register when it is ALREADY
    // granted. The one-shot OS prompt is owned by NotificationPrimerModal (a
    // primed soft-prompt that dramatically lifts opt-in). Firing the bare OS
    // dialog here at login would pre-empt and silently defeat that primer.
    // The primer calls registerDeviceToken() itself once permission is granted.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

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
  entityId?: string;
  actionGroup?: string;
  [key: string]: unknown;
};

function extractData(response: Notifications.NotificationResponse | null): PushData | null {
  const data = response?.notification.request.content.data;
  if (data && typeof data === 'object') return data as PushData;
  return null;
}

/**
 * Route the app in response to a notification tap (no action identifier).
 * `data.type` is the backend category-registry key on current builds
 * (visitor_approvals, deliveries, …); the SCREAMING_SNAKE cases are legacy
 * aliases from older payloads and are kept as fallbacks.
 */
function routeFromData(data: PushData | null) {
  if (!data) return;
  // visitId is the legacy field; entityId is the canonical one going forward.
  const id = (data.entityId as string | undefined) ?? data.visitId;
  switch (data.type) {
    // ── Category registry keys ──────────────────────────────────────────
    case 'visitor_approvals':
    case 'visitors_gate':
      if (id) router.push(`/visitor/review/${id}` as any);
      return;
    case 'deliveries':
      if (id) router.push(`/visitor/review/${id}` as any);
      else router.push('/packages' as any);
      return;
    case 'complaints':
      if (id) router.push(`/complaints/${id}` as any);
      else router.push('/complaints' as any);
      return;
    case 'notices':
    case 'notices_urgent':
    case 'community':
      router.push('/(tabs)/notices' as any);
      return;
    case 'emergency_sos':
      router.push('/medical/sos' as any);
      return;
    // ── Legacy aliases ──────────────────────────────────────────────────
    case 'VISITOR_APPROVAL_REQUEST':
    case 'DELIVERY_APPROVAL_REQUEST':
    case 'VISITOR_ARRIVAL':
      if (id) router.push(`/visitor/review/${id}` as any);
      return;
    case 'COMPLAINT_UPDATED':
      if (data.entityId) router.push(`/complaints/${data.entityId}` as any);
      return;
    case 'PACKAGE_ARRIVED':
      router.push('/packages' as any);
      return;
    case 'NOTICE_PUBLISHED':
      router.push('/(tabs)/notices' as any);
      return;
    case 'SOS_TRIGGERED':
    case 'SOS':
      router.push('/medical/sos' as any);
      return;
    default:
      router.push('/notifications' as any);
  }
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
  const isVisitor =
    data.actionGroup === 'visitor_approval' ||
    data.actionGroup === 'delivery_approval' ||
    data.type === 'visitor_approvals' ||
    data.type === 'visitors_gate' ||
    data.type === 'deliveries' ||
    data.type === 'VISITOR_APPROVAL_REQUEST' ||
    data.type === 'DELIVERY_APPROVAL_REQUEST';
  if (!isVisitor) return;
  const id = (data.entityId as string | undefined) ?? (data.visitId as string | undefined);
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
    await api.post(`/visitors/${id}/decision`, { action });
  } catch {
    /* server is the source of truth; user can retry from the visitor screen */
  }
}

/**
 * Wire tap-routing for warm taps + cold start, AND action-button handling.
 * Returns the listener subscription.
 */
export function setupTapRouting(): Notifications.Subscription {
  // Cold start: the app was launched by tapping a notification (or an action).
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      const data = extractData(response);
      if (!data) return;
      const action = response.actionIdentifier;
      if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        void handleAction(action, data);
      }
      routeFromData(data);
    })
    .catch(() => {
      /* ignore */
    });

  // Warm taps while the app is running/backgrounded.
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = extractData(response);
    if (!data) return;
    const action = response.actionIdentifier;
    if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      void handleAction(action, data);
      return; // action handled; no default route — caller stays where they are
    }
    routeFromData(data);
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
