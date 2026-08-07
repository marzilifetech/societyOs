import { NativeModules, Platform } from 'react-native';

/**
 * Typed wrapper around the `MarziNotifications` Kotlin module
 * (plugins/withNativeNotifications.js).
 *
 * Every call degrades gracefully when the module is absent — iOS, Expo Go, or
 * a JS-only reload against an older native binary. Callers never need to
 * feature-detect; they get a safe default instead of a crash.
 */

export type ChannelStatus = {
  id: string;
  name: string;
  /**
   * Android importance. 0 = the user switched this channel OFF,
   * 2 = LOW (no sound), 3 = DEFAULT, 4 = HIGH (heads-up), 5 = MAX.
   */
  importance: number;
  /** The user turned this specific channel off. */
  blocked: boolean;
  groupId: string | null;
  /** The channel's GROUP is off, which mutes it regardless of `importance`. */
  groupBlocked: boolean;
};

type MarziNotificationsNative = {
  channelsReady?: boolean;
  defaultChannelId?: string;
  areNotificationsEnabled(): Promise<boolean>;
  getChannelStatus(): Promise<ChannelStatus[]>;
  openChannelSettings(channelId: string): Promise<boolean>;
  openNotificationSettings(): Promise<boolean>;
};

const native: MarziNotificationsNative | null =
  Platform.OS === 'android'
    ? ((NativeModules as Record<string, unknown>).MarziNotifications as
        | MarziNotificationsNative
        | undefined) ?? null
    : null;

/** True when the Kotlin module is linked into this binary. */
export const nativeNotificationsAvailable = native != null;

/**
 * True when channels were already created natively in Application.onCreate.
 *
 * When this is true the JS channel setup is redundant and is skipped — that is
 * ~14 sequential bridge round-trips removed from the login path. It is a
 * module CONSTANT, so reading it costs nothing and is available synchronously.
 */
export const nativeChannelsReady = native?.channelsReady === true;

/**
 * Whether notifications are enabled for the app at the OS level.
 *
 * Distinct from expo-notifications' permission status: on Android a user can
 * switch the app's notifications off in system settings and
 * `getPermissionsAsync()` will still report `granted`. This reads the real
 * NotificationManagerCompat state.
 */
export async function areNotificationsEnabled(): Promise<boolean | null> {
  if (!native) return null;
  try {
    return await native.areNotificationsEnabled();
  } catch {
    return null;
  }
}

/**
 * Per-channel importance/blocked state, for the diagnostics screen.
 * Returns [] when unavailable so callers can render "nothing to show".
 */
export async function getChannelStatus(): Promise<ChannelStatus[]> {
  if (!native) return [];
  try {
    return await native.getChannelStatus();
  } catch {
    return [];
  }
}

/** Deep-link to ONE channel's system settings page. */
export async function openChannelSettings(channelId: string): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.openChannelSettings(channelId);
  } catch {
    return false;
  }
}

/** Deep-link to the app's notification settings page. */
export async function openAppNotificationSettings(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.openNotificationSettings();
  } catch {
    return false;
  }
}

/**
 * Channels the staff app cares about, in the order they should be shown to a
 * user who is troubleshooting. Legacy aliases are deliberately excluded —
 * they exist for backwards compatibility, not for humans to reason about.
 */
export const DIAGNOSTIC_CHANNELS: { id: string; label: string; why: string }[] = [
  { id: 'emergency_sos', label: 'Emergency alerts', why: 'SOS and panic alarms' },
  { id: 'approvals', label: 'Approvals', why: 'Visitor, help and task approvals' },
  { id: 'deliveries', label: 'Deliveries & visitors', why: 'Someone is at the gate' },
  { id: 'community', label: 'Community & notices', why: 'Notices, events and updates' },
  { id: 'payments', label: 'Payments & salary', why: 'Salary and payment updates' },
  { id: 'system', label: 'Account & system', why: 'Sign-in and app updates' },
];
