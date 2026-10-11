import type { Ionicons } from '@expo/vector-icons';
import { notificationEntityId, type NotificationData } from '@societyos/mobile-core';
import { api } from './api';

/**
 * Everything the staff app knows about a notification TYPE, in one place:
 * where tapping it goes, how it looks, and what its action buttons call.
 *
 * The lockscreen tap handler, the in-app banner and the inbox each used to
 * carry their own copy of these tables, and they drifted: SOS opened an empty
 * help-request list from all three, leave decisions and visitor-decision
 * results went nowhere from any of them, and the banner's action paths once
 * pointed at routes that do not exist.
 *
 * `type` is the backend's category key (notification-categories.ts) or, for
 * rows and payloads written by older builds, a legacy event name.
 */

/** Legacy event names → the category key that now replaces them. */
const LEGACY_TO_CATEGORY: Record<string, string> = {
  VISITOR_APPROVAL_REQUEST: 'visitor_approvals',
  VISITOR_ARRIVAL: 'visitor_approvals',
  VISITOR_DECISION_RESULT: 'approval_results',
  TASK_ASSIGNED: 'staff_tasks',
  task: 'staff_tasks',
  HELP_REQUEST: 'staff_help_requests',
  help: 'staff_help_requests',
  NOTICE_PUBLISHED: 'notices',
  notice: 'notices',
  EMERGENCY_BROADCAST: 'notices_urgent',
  SOS_TRIGGERED: 'emergency_sos',
  sos: 'emergency_sos',
  LEAVE_APPROVED: 'leave',
  LEAVE_REJECTED: 'leave',
  review: 'reviews',
};

/** Normalise a type to its category key. Unknown types pass through. */
export function categoryOf(type: string | undefined | null): string {
  if (!type) return '';
  return LEGACY_TO_CATEGORY[type] ?? type;
}

/** Where tapping a notification takes the user. Never throws; unknown → inbox. */
export function hrefForNotification(
  type: string | undefined | null,
  data: NotificationData,
): string {
  const id = notificationEntityId(data);
  switch (categoryOf(type)) {
    case 'visitor_approvals':
    case 'visitors_gate':
    case 'deliveries':
    case 'approval_results':
      return '/visitors';
    case 'staff_tasks':
      return id ? `/tasks/${id}` : '/(tabs)/tasks';
    case 'staff_help_requests':
      return id ? `/help-requests/${id}` : '/help-requests';
    case 'notices':
    case 'notices_urgent':
    case 'community':
      return '/community/notices';
    case 'emergency_sos':
      // The active-SOS screen — the help-request list these used to open
      // never contains SOS alerts, so guards landed on an empty screen.
      return id ? `/sos/alerts?focus=${encodeURIComponent(id)}` : '/sos/alerts';
    case 'leave':
      return '/leave/history';
    case 'reviews':
      return '/reviews';
    case 'payments':
      return '/salary';
    default:
      return '/notifications';
  }
}

export type NotificationVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
};

const SUCCESS_INK = '#1F7A45';

const CATEGORY_VISUALS: Record<string, NotificationVisual> = {
  visitor_approvals: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  visitors_gate: { icon: 'person', tint: '#9A6B00', bg: '#FBF1D9' },
  staff_tasks: { icon: 'checkbox', tint: '#2563EB', bg: '#DBEAFE' },
  staff_help_requests: { icon: 'hand-left', tint: '#7C3AED', bg: '#EDE9FE' },
  deliveries: { icon: 'cube', tint: '#0284C7', bg: '#E0F2FE' },
  notices: { icon: 'megaphone', tint: '#9A6B00', bg: '#FBF1D9' },
  notices_urgent: { icon: 'megaphone', tint: '#C42847', bg: '#FCE9EE' },
  payments: { icon: 'card', tint: SUCCESS_INK, bg: '#E7F4EC' },
  emergency_sos: { icon: 'alert', tint: '#C42847', bg: '#FCE9EE' },
  complaints: { icon: 'chatbubble', tint: '#7C3AED', bg: '#EDE9FE' },
  approval_results: { icon: 'checkmark-circle', tint: SUCCESS_INK, bg: '#E7F4EC' },
  account_auth: { icon: 'shield-checkmark', tint: '#475569', bg: '#F1F5F9' },
  leave: { icon: 'calendar', tint: '#2563EB', bg: '#DBEAFE' },
  reviews: { icon: 'star', tint: '#9A6B00', bg: '#FBF1D9' },
};

const DEFAULT_VISUAL: NotificationVisual = {
  icon: 'notifications',
  tint: '#821A52',
  bg: '#EFF4FB',
};

export function visualForNotification(type: string | undefined | null): NotificationVisual {
  return CATEGORY_VISUALS[categoryOf(type)] ?? DEFAULT_VISUAL;
}

/** True for alerts that must stay on screen until the guard acts on them. */
export function isEmergencyNotification(type: string | undefined | null): boolean {
  return categoryOf(type) === 'emergency_sos';
}

export type NotificationAction = { id: string; label: string; destructive: boolean };

/** Buttons for a push's `actionGroup` (mirrors the iOS categories). */
export function actionsForGroup(group: string | undefined): NotificationAction[] | null {
  switch (group) {
    case 'help_request':
      return [
        { id: 'DECLINE', label: 'Decline', destructive: true },
        { id: 'ACCEPT', label: 'Accept', destructive: false },
      ];
    case 'task_assignment':
      return [
        { id: 'REJECT', label: 'Reject', destructive: true },
        { id: 'ACCEPT', label: 'Accept', destructive: false },
      ];
    default:
      return null;
  }
}

/**
 * Run an action button, from the lockscreen or the in-app banner. Throws on
 * failure so the caller can say so — a silently failed Accept is lost work.
 * Every endpoint is idempotent server-side, so duplicate taps collapse.
 *
 * Returns false when the group/action pair is not one this app handles.
 */
export async function performNotificationAction(
  group: string | undefined,
  actionId: string,
  entityId: string,
): Promise<boolean> {
  const id = encodeURIComponent(entityId);
  if (group === 'help_request') {
    if (actionId === 'ACCEPT') await api.post(`/staff/help-requests/${id}/accept`, {});
    else if (actionId === 'DECLINE') await api.post(`/staff/help-requests/${id}/decline`, {});
    else return false;
    return true;
  }
  if (group === 'task_assignment') {
    if (actionId === 'ACCEPT') await api.post(`/service-requests/${id}/accept`, {});
    else if (actionId === 'REJECT') await api.post(`/service-requests/${id}/reject`, {});
    else return false;
    return true;
  }
  return false;
}
