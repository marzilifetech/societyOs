/**
 * Permission catalogue — the single source of truth for what an admin can do.
 *
 * WHY PERMISSIONS LIVE IN CODE, NOT IN A TABLE
 * --------------------------------------------
 * A permission is only meaningful if some route actually checks it, so the set
 * is defined by the codebase, not by data. Keeping it here means:
 *   • `@RequirePermission('residents:approve')` is type-checked — a typo is a
 *     compile error, not a route that silently allows everyone.
 *   • Every permission is greppable to the exact handlers that enforce it.
 *   • There is no migration needed to add one.
 *
 * ROLES, by contrast, ARE data (see the AdminRole model): societies genuinely
 * need their own combinations, and those change without a deploy.
 *
 * NAMING: `<resource>:<action>`. Keep resources aligned with module names so
 * the mapping from a route to its permission stays obvious.
 */
export const PERMISSIONS = {
  // ── People ────────────────────────────────────────────────────────────────
  RESIDENTS_READ: 'residents:read',
  RESIDENTS_APPROVE: 'residents:approve',
  RESIDENTS_WRITE: 'residents:write',
  RESIDENTS_EXPORT: 'residents:export',

  STAFF_READ: 'staff:read',
  STAFF_WRITE: 'staff:write',
  STAFF_DEACTIVATE: 'staff:deactivate',
  STAFF_ATTENDANCE_READ: 'staff:attendance:read',
  STAFF_LEAVES_APPROVE: 'staff:leaves:approve',

  // ── Operations ────────────────────────────────────────────────────────────
  VISITORS_READ: 'visitors:read',
  VISITORS_WRITE: 'visitors:write',
  COMPLAINTS_READ: 'complaints:read',
  COMPLAINTS_ASSIGN: 'complaints:assign',
  SERVICE_REQUESTS_READ: 'service_requests:read',
  SERVICE_REQUESTS_ASSIGN: 'service_requests:assign',
  AMENITIES_MANAGE: 'amenities:manage',
  PARKING_MANAGE: 'parking:manage',

  // ── Communication ─────────────────────────────────────────────────────────
  NOTICES_PUBLISH: 'notices:publish',
  EVENTS_MANAGE: 'events:manage',
  POLLS_MANAGE: 'polls:manage',

  // ── Money ─────────────────────────────────────────────────────────────────
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  PAYMENTS_READ: 'payments:read',

  // ── Safety ────────────────────────────────────────────────────────────────
  SOS_READ: 'sos:read',
  SOS_RESPOND: 'sos:respond',

  // ── Governance ────────────────────────────────────────────────────────────
  REPORTS_READ: 'reports:read',
  DOCUMENTS_MANAGE: 'documents:manage',
  SETTINGS_WRITE: 'settings:write',

  /**
   * The meta-permission. Anyone holding it can add, re-role and remove OTHER
   * admins of the same society — this is what makes "multiple admins"
   * self-service instead of a super-admin-only operation.
   *
   * Deliberately NOT part of any preset except Owner: handing it out casually
   * lets a junior admin grant themselves everything else.
   */
  ADMINS_MANAGE: 'admins:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Grouping for the admin UI. Purely presentational. */
export const PERMISSION_GROUPS: { group: string; permissions: Permission[] }[] = [
  {
    group: 'People',
    permissions: [
      PERMISSIONS.RESIDENTS_READ,
      PERMISSIONS.RESIDENTS_APPROVE,
      PERMISSIONS.RESIDENTS_WRITE,
      PERMISSIONS.RESIDENTS_EXPORT,
      PERMISSIONS.STAFF_READ,
      PERMISSIONS.STAFF_WRITE,
      PERMISSIONS.STAFF_DEACTIVATE,
      PERMISSIONS.STAFF_ATTENDANCE_READ,
      PERMISSIONS.STAFF_LEAVES_APPROVE,
    ],
  },
  {
    group: 'Operations',
    permissions: [
      PERMISSIONS.VISITORS_READ,
      PERMISSIONS.VISITORS_WRITE,
      PERMISSIONS.COMPLAINTS_READ,
      PERMISSIONS.COMPLAINTS_ASSIGN,
      PERMISSIONS.SERVICE_REQUESTS_READ,
      PERMISSIONS.SERVICE_REQUESTS_ASSIGN,
      PERMISSIONS.AMENITIES_MANAGE,
      PERMISSIONS.PARKING_MANAGE,
    ],
  },
  {
    group: 'Communication',
    permissions: [PERMISSIONS.NOTICES_PUBLISH, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.POLLS_MANAGE],
  },
  {
    group: 'Money',
    permissions: [PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_WRITE, PERMISSIONS.PAYMENTS_READ],
  },
  { group: 'Safety', permissions: [PERMISSIONS.SOS_READ, PERMISSIONS.SOS_RESPOND] },
  {
    group: 'Governance',
    permissions: [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.DOCUMENTS_MANAGE,
      PERMISSIONS.SETTINGS_WRITE,
      PERMISSIONS.ADMINS_MANAGE,
    ],
  },
];

/**
 * System role presets, seeded for every society and not editable.
 *
 * `key` is stable and referenced by API callers; `name` is display-only.
 * Societies can create their own roles on top of these — see AdminRole.
 */
export const SYSTEM_ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access, including managing other admins.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'manager',
    name: 'Society Manager',
    description: 'Day-to-day operations. Cannot manage admins or billing.',
    permissions: [
      PERMISSIONS.RESIDENTS_READ,
      PERMISSIONS.RESIDENTS_APPROVE,
      PERMISSIONS.RESIDENTS_WRITE,
      PERMISSIONS.STAFF_READ,
      PERMISSIONS.STAFF_WRITE,
      PERMISSIONS.STAFF_ATTENDANCE_READ,
      PERMISSIONS.STAFF_LEAVES_APPROVE,
      PERMISSIONS.VISITORS_READ,
      PERMISSIONS.VISITORS_WRITE,
      PERMISSIONS.COMPLAINTS_READ,
      PERMISSIONS.COMPLAINTS_ASSIGN,
      PERMISSIONS.SERVICE_REQUESTS_READ,
      PERMISSIONS.SERVICE_REQUESTS_ASSIGN,
      PERMISSIONS.AMENITIES_MANAGE,
      PERMISSIONS.PARKING_MANAGE,
      PERMISSIONS.NOTICES_PUBLISH,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.POLLS_MANAGE,
      PERMISSIONS.SOS_READ,
      PERMISSIONS.SOS_RESPOND,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.DOCUMENTS_MANAGE,
    ],
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Billing, payments and financial reports only.',
    permissions: [
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_WRITE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESIDENTS_READ,
    ],
  },
  {
    key: 'security_head',
    name: 'Security Head',
    description: 'Gate, visitors, SOS and security staff.',
    permissions: [
      PERMISSIONS.VISITORS_READ,
      PERMISSIONS.VISITORS_WRITE,
      PERMISSIONS.SOS_READ,
      PERMISSIONS.SOS_RESPOND,
      PERMISSIONS.STAFF_READ,
      PERMISSIONS.STAFF_ATTENDANCE_READ,
      PERMISSIONS.RESIDENTS_READ,
    ],
  },
  {
    key: 'block_admin',
    name: 'Block Admin',
    description: 'Manager-level access, limited to assigned blocks.',
    permissions: [
      PERMISSIONS.RESIDENTS_READ,
      PERMISSIONS.RESIDENTS_APPROVE,
      PERMISSIONS.COMPLAINTS_READ,
      PERMISSIONS.COMPLAINTS_ASSIGN,
      PERMISSIONS.SERVICE_REQUESTS_READ,
      PERMISSIONS.SERVICE_REQUESTS_ASSIGN,
      PERMISSIONS.VISITORS_READ,
      PERMISSIONS.NOTICES_PUBLISH,
    ],
  },
  {
    key: 'viewer',
    name: 'Read only',
    description: 'Can see everything operational, change nothing.',
    permissions: [
      PERMISSIONS.RESIDENTS_READ,
      PERMISSIONS.STAFF_READ,
      PERMISSIONS.STAFF_ATTENDANCE_READ,
      PERMISSIONS.VISITORS_READ,
      PERMISSIONS.COMPLAINTS_READ,
      PERMISSIONS.SERVICE_REQUESTS_READ,
      PERMISSIONS.SOS_READ,
      PERMISSIONS.REPORTS_READ,
    ],
  },
];
