/**
 * Canonical registry of notification categories.
 *
 * One entry per mutable "channel" a user can see in settings. The `key` is used
 * as:
 *   - the Android notification channel id (client mirrors these),
 *   - the `category` on PushNotification / NotificationPreference,
 *   - the opt-out lookup key.
 *
 * `mutable: false` => force-on; the backend MUST ignore any stored preference
 * and always deliver (e.g. emergency/SOS, OTP). Derived from research on
 * MyGate / NoBrokerHood / ADDA notification models.
 */
export type NotificationImportance = 'high' | 'default' | 'low';
export type NotificationAudience = 'resident' | 'staff' | 'admin';

/**
 * Coarse-grained type used to drive the FCM payload — Android channelId,
 * priority, iOS interruption-level, custom sound key. Each fine-grained
 * category below maps to exactly one of these. The apps register matching
 * channels under the same keys (see resident-app/src/lib/push.ts +
 * staff-app/src/lib/notifications.ts).
 *
 *   MARKETING  — gentle, default importance, no lockscreen disruption
 *   DELIVERY   — heads-up over lockscreen, custom chime, action buttons
 *   EMERGENCY  — heads-up over lockscreen, custom siren, MAX importance,
 *                attempts DND bypass, distinct vibration
 */
export type NotificationType = 'MARKETING' | 'DELIVERY' | 'EMERGENCY';

/**
 * Android notification channel ids. The apps create ALL of these on startup
 * and the backend routes every push to exactly one of them:
 *
 *   emergency_sos — MAX importance, bypassDnd, public lockscreen
 *   approvals     — HIGH; visitor/delivery/help/task approvals + approval_results
 *   deliveries    — HIGH
 *   community     — DEFAULT; notices, events, polls, welfare (replaces legacy 'marketing')
 *   payments      — DEFAULT
 *   system        — DEFAULT/LOW; account_auth, app updates, misc
 */
export type NotificationChannelId =
  | 'emergency_sos'
  | 'approvals'
  | 'deliveries'
  | 'community'
  | 'payments'
  | 'system';

export interface NotificationCategory {
  key: string;
  /**
   * Coarse-grained type the apps map to an Android channel / iOS interruption
   * level. See the {@link NotificationType} doc for behavior per type.
   */
  type: NotificationType;
  /**
   * Android channel this category's pushes are routed to. The apps register
   * the full {@link NotificationChannelId} set; `buildMessage` in
   * push.service.ts prefers this over the coarse `type` mapping.
   */
  channelId: NotificationChannelId;
  label: string;
  description: string;
  /** Shipped default when the user has no explicit preference row. */
  defaultEnabled: boolean;
  /** false => force-on; preference is ignored server-side. */
  mutable: boolean;
  importance: NotificationImportance;
  /** Renders action buttons (approve/reject) client-side. */
  actionable: boolean;
  /** Which app audiences this category is offered to. */
  audiences: NotificationAudience[];
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'visitors_gate',
    channelId: 'approvals',
    type: 'DELIVERY',
    label: 'Visitor arrivals',
    description: 'A guest or cab has arrived at the gate for your approval.',
    defaultEnabled: true,
    mutable: true,
    importance: 'high',
    actionable: true,
    audiences: ['resident', 'staff'],
  },
  {
    key: 'deliveries',
    channelId: 'deliveries',
    type: 'DELIVERY',
    label: 'Deliveries & parcels',
    description: 'A delivery agent is at the gate, or a parcel is held for you.',
    defaultEnabled: true,
    mutable: true,
    importance: 'high',
    actionable: true,
    audiences: ['resident'],
  },
  {
    key: 'daily_help',
    channelId: 'community',
    type: 'MARKETING',
    label: 'Daily help & vendors',
    description: 'Maid, cook, driver, milk and other recurring vendor entries.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['resident'],
  },
  {
    key: 'family_vehicle',
    channelId: 'community',
    type: 'MARKETING',
    label: 'Family & vehicle',
    description: 'Family member, child or vehicle entry and exit.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['resident'],
  },
  {
    key: 'complaints',
    channelId: 'system',
    type: 'MARKETING',
    label: 'Complaints & service requests',
    description: 'Updates on your complaints and service requests.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['resident', 'admin'],
  },
  {
    key: 'notices',
    channelId: 'community',
    type: 'MARKETING',
    label: 'Notices & announcements',
    description: 'General society notices and announcements.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['resident', 'staff', 'admin'],
  },
  {
    key: 'notices_urgent',
    channelId: 'community',
    // Urgent notices reach residents loudly but they are NOT emergencies in
    // the SOS sense — the user opted into society-admin authored "critical"
    // notices. Route them as DELIVERY (lockscreen + heads-up) so they break
    // through DND-style filtering without hijacking the screen the way SOS
    // does. If society-admins start abusing this and the user complains, the
    // mapping is one line below.
    type: 'DELIVERY',
    label: 'Urgent notices',
    description: 'Critical alerts: water, power, safety. Always on.',
    defaultEnabled: true,
    mutable: false,
    importance: 'high',
    actionable: false,
    audiences: ['resident', 'staff', 'admin'],
  },
  {
    key: 'community',
    channelId: 'community',
    type: 'MARKETING',
    label: 'Community & celebrations',
    description: 'Events, polls and birthday/anniversary celebrations.',
    defaultEnabled: true,
    mutable: true,
    importance: 'low',
    actionable: false,
    audiences: ['resident'],
  },
  {
    key: 'payments_dues',
    channelId: 'payments',
    type: 'MARKETING',
    label: 'Payments & dues',
    description: 'Maintenance dues, invoices and payment receipts.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['resident'],
  },
  {
    key: 'emergency_sos',
    channelId: 'emergency_sos',
    type: 'EMERGENCY',
    label: 'Emergency & SOS',
    description: 'Panic / SOS alerts. Always on.',
    defaultEnabled: true,
    mutable: false,
    importance: 'high',
    actionable: true,
    audiences: ['resident', 'staff', 'admin'],
  },
  {
    key: 'staff_tasks',
    channelId: 'approvals',
    type: 'MARKETING',
    label: 'Duty & tasks',
    description: 'Patrol reminders, shift handovers and task assignments.',
    defaultEnabled: true,
    mutable: true,
    importance: 'default',
    actionable: false,
    audiences: ['staff', 'admin'],
  },
  {
    key: 'approval_results',
    channelId: 'approvals',
    type: 'DELIVERY',
    label: 'Approval outcomes',
    description: 'Resident decisions on visitors you logged. Always on.',
    defaultEnabled: true,
    mutable: false,
    importance: 'high',
    actionable: false,
    audiences: ['staff'],
  },
  {
    key: 'account_auth',
    channelId: 'system',
    type: 'DELIVERY',
    label: 'Account & security',
    description: 'OTP, logins and role changes. Always on.',
    defaultEnabled: true,
    mutable: false,
    importance: 'high',
    actionable: false,
    audiences: ['resident', 'staff', 'admin'],
  },
];

const BY_KEY = new Map(NOTIFICATION_CATEGORIES.map((c) => [c.key, c]));

export function getCategory(key: string): NotificationCategory | undefined {
  return BY_KEY.get(key);
}

/** A category is mutable only if it exists in the registry and is flagged mutable. */
export function isCategoryMutable(key: string): boolean {
  return BY_KEY.get(key)?.mutable ?? true;
}

/** Force-on categories must never be suppressed by a stored preference. */
export function isForceOn(key: string): boolean {
  const c = BY_KEY.get(key);
  return c ? !c.mutable : false;
}

/** Categories offered to a given app audience (for the settings UI). */
export function categoriesForAudience(audience: NotificationAudience): NotificationCategory[] {
  return NOTIFICATION_CATEGORIES.filter((c) => c.audiences.includes(audience));
}

/**
 * Resolve a category key (or a free-form `data.type` string from a payload) to
 * the coarse-grained {@link NotificationType}. Unknown keys default to
 * `MARKETING` — the safe, non-disruptive class. The same map is used in
 * `push.service.ts` to pick channel id, FCM priority and APNs interruption
 * level for every outgoing notification.
 */
export function getNotificationType(key: string | undefined | null): NotificationType {
  if (!key) return 'MARKETING';
  const exact = BY_KEY.get(key);
  if (exact) return exact.type;
  // Allow callers to pass legacy/aliased strings (e.g. 'sos', 'SOS_TRIGGERED')
  // that don't appear in the registry but clearly belong to one type.
  const k = key.toLowerCase();
  if (k === 'sos' || k.includes('sos_') || k.includes('emergency')) return 'EMERGENCY';
  if (k.includes('visitor') || k.includes('delivery') || k.includes('package')) return 'DELIVERY';
  return 'MARKETING';
}
