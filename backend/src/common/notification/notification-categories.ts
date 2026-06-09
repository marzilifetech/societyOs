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

export interface NotificationCategory {
  key: string;
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
