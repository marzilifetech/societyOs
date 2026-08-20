/**
 * Client mirror of the backend permission catalogue
 * (backend/src/common/permissions/permissions.ts).
 *
 * Duplicated deliberately rather than fetched: nav gating has to be a
 * synchronous decision at first paint, and a string typo here would silently
 * hide a menu item forever. Keeping it as a typed const means a rename that is
 * not mirrored fails the build instead.
 *
 * These strings gate DISPLAY only. Every one is enforced server-side too — the
 * UI hiding a button is a courtesy, not the security boundary.
 */
export const PERMISSIONS = {
  RESIDENTS_READ: 'residents:read',
  RESIDENTS_APPROVE: 'residents:approve',
  RESIDENTS_WRITE: 'residents:write',
  RESIDENTS_EXPORT: 'residents:export',
  STAFF_READ: 'staff:read',
  STAFF_WRITE: 'staff:write',
  STAFF_DEACTIVATE: 'staff:deactivate',
  STAFF_ATTENDANCE_READ: 'staff:attendance:read',
  STAFF_LEAVES_APPROVE: 'staff:leaves:approve',
  VISITORS_READ: 'visitors:read',
  VISITORS_WRITE: 'visitors:write',
  COMPLAINTS_READ: 'complaints:read',
  COMPLAINTS_ASSIGN: 'complaints:assign',
  SERVICE_REQUESTS_READ: 'service_requests:read',
  SERVICE_REQUESTS_ASSIGN: 'service_requests:assign',
  AMENITIES_MANAGE: 'amenities:manage',
  PARKING_MANAGE: 'parking:manage',
  NOTICES_PUBLISH: 'notices:publish',
  EVENTS_MANAGE: 'events:manage',
  POLLS_MANAGE: 'polls:manage',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  PAYMENTS_READ: 'payments:read',
  SOS_READ: 'sos:read',
  SOS_RESPOND: 'sos:respond',
  REPORTS_READ: 'reports:read',
  DOCUMENTS_MANAGE: 'documents:manage',
  SETTINGS_WRITE: 'settings:write',
  ADMINS_MANAGE: 'admins:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface EffectiveAccess {
  userId: string;
  societyId: string;
  isSuperAdmin: boolean;
  roleKey: string | null;
  roleName: string | null;
  permissions: Permission[];
  /** Empty = whole society. Non-empty = only these blocks. */
  blocks: string[];
}
