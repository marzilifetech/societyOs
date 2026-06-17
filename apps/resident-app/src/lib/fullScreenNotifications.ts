/**
 * Full-screen (call-style) notifications via Notifee + RN-Firebase messaging.
 *
 * Still 100% Firebase/FCM — RN-Firebase is just the client library that lets us
 * receive a data message in the background/killed state (`setBackgroundMessageHandler`),
 * which expo-notifications cannot do. Notifee then renders a full-screen,
 * screen-waking notification (`fullScreenAction` + `AndroidCategory.CALL`) with
 * Approve/Reject buttons handled in JS — no native Activity, no deep-link hack.
 *
 * Backend sends these as data-only with `data.fullScreen === 'true'` (see
 * PushService). Only visitor-approval pushes are full-screen on the resident app.
 *
 * NOTE: module-scope side effects below register the background handlers; this
 * module MUST be imported once from the app entry (index.js) before React loads.
 */
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  type Event,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { api } from './api';

type Data = Record<string, string>;

const VISITOR_TYPES = ['VISITOR_APPROVAL_REQUEST', 'DELIVERY_APPROVAL_REQUEST'];

function isVisitor(data: Data): boolean {
  return VISITOR_TYPES.includes(data.type);
}

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

function buildActions(data: Data) {
  if (isVisitor(data)) {
    return [
      { title: 'Approve', pressAction: { id: 'approve', launchActivity: 'default' } },
      { title: 'Reject', pressAction: { id: 'reject' } },
    ];
  }
  // SOS (staff app): Acknowledge hits the ack endpoint; tapping opens the app.
  return [{ title: 'Acknowledge', pressAction: { id: 'acknowledge', launchActivity: 'default' } }];
}

/** Raise a full-screen, screen-waking notification from FCM data. */
export async function displayFullScreen(data: Data): Promise<void> {
  const channelId = data.channelId || (isVisitor(data) ? 'visitors_gate' : 'emergency_sos');
  await ensureChannel(channelId);
  await notifee.displayNotification({
    title: data.title || 'Alert',
    body: data.body || '',
    data,
    android: {
      channelId,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      // The full-screen intent — wakes the screen / shows over the lock screen.
      fullScreenAction: { id: 'default', launchActivity: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: buildActions(data),
      autoCancel: true,
      ongoing: true,
      timestamp: Date.now(),
      showTimestamp: true,
    },
  });
}

/** Run the chosen action against the existing backend endpoints. */
async function performAction(actionId: string, data: Data): Promise<void> {
  const id = data.entityId || data.visitId || data.alertId;
  if (!id) return;
  if (isVisitor(data)) {
    const map: Record<string, string> = {
      approve: 'APPROVE',
      reject: 'REJECT',
      leave_at_security: 'LEAVE_AT_SECURITY',
    };
    const action = map[actionId];
    if (!action) return; // 'default' / 'view' just opens the app
    try {
      await api.post(`/visitors/${id}/decision`, { action });
    } catch {
      /* server is source of truth; user can retry from the visitor screen */
    }
  } else if (data.type?.startsWith('SOS') && actionId === 'acknowledge') {
    try {
      await api.patch(`/sos/${id}/acknowledge`, {});
    } catch {
      /* retry from the SOS screen */
    }
  }
}

async function handleEvent({ type, detail }: Event): Promise<void> {
  if (type === EventType.ACTION_PRESS && detail.pressAction) {
    await performAction(detail.pressAction.id, (detail.notification?.data || {}) as Data);
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }
}

// ── Background/killed registration (module scope — runs at import) ──────────
messaging().setBackgroundMessageHandler(async (msg) => {
  if (msg.data?.fullScreen === 'true') {
    await displayFullScreen(msg.data as Data);
  }
});
notifee.onBackgroundEvent(handleEvent);

/**
 * Foreground handlers — call once from the root layout. Returns an unsubscribe.
 */
export function registerForegroundFullScreen(): () => void {
  const unsubMessage = messaging().onMessage(async (msg) => {
    if (msg.data?.fullScreen === 'true') {
      await displayFullScreen(msg.data as Data);
    }
  });
  const unsubEvent = notifee.onForegroundEvent(handleEvent);
  return () => {
    unsubMessage();
    unsubEvent();
  };
}
