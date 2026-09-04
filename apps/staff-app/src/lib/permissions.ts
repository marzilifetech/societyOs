import { Alert, Linking, Platform } from 'react-native';
import * as Camera from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

/**
 * One place that owns every runtime permission the staff app asks for.
 *
 * WHY THIS EXISTS
 * ---------------
 * Permissions were previously requested ad hoc at three separate call sites,
 * each with its own shape and its own idea of what to do on refusal:
 *
 *   • `geo.ts` re-requested location on EVERY `getCurrentPosition()` and
 *     returned a bare `null` on failure — so a caller could not tell "the user
 *     said no" from "GPS timed out" from "we are indoors". Check-in silently
 *     proceeded without a location.
 *   • `cameraUtils.ts` collapsed everything to 'granted' | 'denied', losing the
 *     one distinction that matters (see below).
 *   • `entry/new.tsx` told the user to "Open Settings → Permissions → Camera"
 *     and then left them to find it themselves.
 *
 * THE DISTINCTION THAT MATTERS
 * ----------------------------
 * "Denied" and "permanently blocked" need completely different handling, and
 * conflating them is what makes permission UX feel broken:
 *
 *   denied   → the OS will still show its dialog. Asking again is useful.
 *   blocked  → on Android 13+ (and iOS after the first refusal) a second
 *              request resolves immediately having displayed NOTHING. An app
 *              that keeps calling request() here looks like a button that does
 *              nothing at all. The only route forward is the OS settings page.
 *
 * `canAskAgain` from expo is what separates the two, and it is why every
 * function here returns a typed outcome instead of a boolean.
 *
 * NOTHING HERE SILENTLY SUCCEEDS OR SILENTLY FAILS. Callers get an outcome
 * they have to handle.
 */

export type PermissionKind = 'camera' | 'location' | 'photos' | 'notifications';

export type PermissionOutcome =
  /** Usable right now. */
  | 'granted'
  /** Refused, but the OS will ask again if we request. */
  | 'denied'
  /** Refused for good. Only the OS settings page can change this. */
  | 'blocked'
  /** The device cannot provide it (e.g. push tokens on a simulator). */
  | 'unavailable';

export interface PermissionResult {
  outcome: PermissionOutcome;
  granted: boolean;
}

/** Human copy per permission, used for the rationale and the blocked prompt. */
const COPY: Record<
  PermissionKind,
  { label: string; why: string; settingsPath: string }
> = {
  camera: {
    label: 'Camera',
    why: 'Photos are proof that work was done and that a visitor was who they said they were. Without the camera you cannot start or complete a task.',
    settingsPath: Platform.OS === 'ios' ? 'Settings → One Community Staff → Camera' : 'Settings → Apps → Permissions → Camera',
  },
  location: {
    label: 'Location',
    why: 'Your location confirms you are on society premises when you check in, and is attached to an SOS so help can find you.',
    settingsPath: Platform.OS === 'ios' ? 'Settings → One Community Staff → Location' : 'Settings → Apps → Permissions → Location',
  },
  photos: {
    label: 'Photos',
    why: 'Needed to attach an existing photo or document to a task or upload.',
    settingsPath: Platform.OS === 'ios' ? 'Settings → One Community Staff → Photos' : 'Settings → Apps → Permissions → Photos',
  },
  notifications: {
    label: 'Notifications',
    why: 'New tasks, gate entries and emergencies reach you as notifications. With them off you will only find out by opening the app.',
    settingsPath: Platform.OS === 'ios' ? 'Settings → One Community Staff → Notifications' : 'Settings → Apps → Notifications',
  },
};

/** Normalises the three shapes expo returns into one outcome. */
function toOutcome(status: string, canAskAgain: boolean | undefined): PermissionResult {
  if (status === 'granted') return { outcome: 'granted', granted: true };
  // `undetermined` always means we can still ask.
  if (status === 'undetermined') return { outcome: 'denied', granted: false };
  // Denied: `canAskAgain === false` is the permanent case. When expo does not
  // report it we assume we can ask — a redundant prompt is recoverable, a
  // wrongly-blocked permission strands the user.
  return { outcome: canAskAgain === false ? 'blocked' : 'denied', granted: false };
}

/** Current state, without prompting. Safe to call on every render path. */
export async function checkPermission(kind: PermissionKind): Promise<PermissionResult> {
  try {
    switch (kind) {
      case 'camera': {
        const r = await Camera.Camera.getCameraPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'location': {
        const r = await Location.getForegroundPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'photos': {
        const r = await ImagePicker.getMediaLibraryPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'notifications': {
        if (!Constants.isDevice) return { outcome: 'unavailable', granted: false };
        const r = await Notifications.getPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
    }
  } catch {
    return { outcome: 'denied', granted: false };
  }
}

/** Prompt the OS. Never call this when `checkPermission` says 'blocked'. */
export async function requestPermission(kind: PermissionKind): Promise<PermissionResult> {
  try {
    switch (kind) {
      case 'camera': {
        const r = await Camera.Camera.requestCameraPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'location': {
        const r = await Location.requestForegroundPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'photos': {
        const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return toOutcome(r.status, r.canAskAgain);
      }
      case 'notifications': {
        if (!Constants.isDevice) return { outcome: 'unavailable', granted: false };
        const r = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: false },
        });
        return toOutcome(r.status, r.canAskAgain);
      }
    }
  } catch {
    return { outcome: 'denied', granted: false };
  }
}

/** Opens this app's page in the OS settings app. */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // openSettings is unavailable on a few OEM Android builds; fall back to the
    // app-details intent rather than leaving the button inert.
    try {
      await Linking.openURL('app-settings:');
    } catch {
      /* nothing else to try */
    }
  }
}

/**
 * The function almost every caller wants.
 *
 * Resolves to a usable permission, or explains why not:
 *
 *   1. Already granted            → returns immediately, no dialogs.
 *   2. Can still ask              → optionally shows a rationale FIRST (only
 *                                   where the need is not self-evident from
 *                                   what the user just tapped), then prompts.
 *   3. Permanently blocked        → does NOT call request(), which would do
 *                                   nothing. Offers to open OS settings.
 *
 * @param withRationale Show a short explanation before the OS dialog. Leave
 *   false when the user has just tapped something that obviously needs it
 *   (a camera button) — an extra dialog there is friction, not clarity.
 */
export async function ensurePermission(
  kind: PermissionKind,
  opts: { withRationale?: boolean; blockedMessage?: string } = {},
): Promise<PermissionResult> {
  const current = await checkPermission(kind);
  if (current.granted || current.outcome === 'unavailable') return current;

  if (current.outcome === 'blocked') {
    await promptOpenSettings(kind, opts.blockedMessage);
    // Re-read: the user may have granted it and come back.
    return checkPermission(kind);
  }

  if (opts.withRationale) {
    const proceed = await confirmRationale(kind);
    if (!proceed) return { outcome: 'denied', granted: false };
  }

  const after = await requestPermission(kind);
  if (after.outcome === 'blocked') await promptOpenSettings(kind, opts.blockedMessage);
  return after;
}

function confirmRationale(kind: PermissionKind): Promise<boolean> {
  const c = COPY[kind];
  return new Promise((resolve) => {
    Alert.alert(`${c.label} access`, c.why, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

function promptOpenSettings(kind: PermissionKind, message?: string): Promise<void> {
  const c = COPY[kind];
  return new Promise((resolve) => {
    Alert.alert(
      `${c.label} is turned off`,
      // The path is spelled out as well as deep-linked: on some Android OEM
      // builds openSettings lands on the app list rather than this app's page.
      `${message ?? c.why}\n\nTurn it on under ${c.settingsPath}.`,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Open settings',
          onPress: () => {
            void openAppSettings();
            resolve();
          },
        },
      ],
    );
  });
}
