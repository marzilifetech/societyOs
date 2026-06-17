/**
 * Full-screen (call-style) notifications.
 *
 * Flow (100% Firebase/FCM): RN-Firebase delivers the push — including in the
 * background/killed state via `setBackgroundMessageHandler` — and for messages
 * flagged `data.fullScreen === 'true'` we call the native `FullScreenAlert`
 * module. It posts a notification with `setFullScreenIntent(...)` →
 * `FullScreenAlertActivity` (showWhenLocked / turnScreenOn), carrying the data
 * as intent extras so the activity shows the real content. The OS honours the
 * full-screen intent over the lock screen — a genuine call-style takeover.
 *
 * We do NOT use Notifee's `fullScreenAction` (it does not reliably launch a
 * custom activity). Notifee is used only to ensure the Android channels exist.
 *
 * Module-scope side effects below register the background handler, so this
 * module MUST be imported once from the app entry (index.js) before React loads.
 */
import { NativeModules } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

type Data = Record<string, string>;

const VISITOR_TYPES = ['VISITOR_APPROVAL_REQUEST', 'DELIVERY_APPROVAL_REQUEST'];
const isVisitor = (data: Data) => VISITOR_TYPES.includes(data.type);

const { FullScreenAlert } = NativeModules as {
  FullScreenAlert?: { present: (data: Data) => void };
};

async function ensureChannel(channelId: string): Promise<void> {
  await notifee.createChannel({
    id: channelId,
    name: channelId === 'emergency_sos' ? 'Emergency Alerts' : 'Visitor & Gate Alerts',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: channelId === 'emergency_sos',
    vibration: true,
  });
}

/** Raise the native full-screen alert from an FCM data payload. */
export async function displayFullScreen(data: Data): Promise<void> {
  const channelId = data.channelId || (isVisitor(data) ? 'visitors_gate' : 'emergency_sos');
  await ensureChannel(channelId);
  FullScreenAlert?.present({
    channelId,
    title: data.title || 'Alert',
    body: data.body || '',
    type: data.type || '',
    id: data.entityId || data.visitId || data.alertId || '',
  });
}

// ── Background/killed registration (module scope — runs at import) ──────────
try {
  messaging().setBackgroundMessageHandler(async (msg) => {
    if (msg.data?.fullScreen === 'true') {
      await displayFullScreen(msg.data as Data);
    }
  });
} catch (e) {
  console.warn('[fullscreen] background handler not registered:', e);
}

/** Foreground handler — call once from the root layout. Returns an unsubscribe. */
export function registerForegroundFullScreen(): () => void {
  return messaging().onMessage(async (msg) => {
    if (msg.data?.fullScreen === 'true') {
      await displayFullScreen(msg.data as Data);
    }
  });
}
