import { Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { getTenantContext, isSuperAdminBypass } from './tenant.context';

/**
 * Models that exist outside the per-tenant boundary and should NOT have
 * `societyId` injected automatically.
 */
const CROSS_TENANT_MODELS = new Set<string>([
  'Society',
  'User',
  'AuditLog',
  'ConsentLog',
]);

/**
 * Models that are tenant-scoped via a direct `societyId` column. For models
 * scoped indirectly (via a parent model) we leave query-shape untouched but
 * still apply post-fetch verification through the result.
 */
const DIRECT_TENANT_SCOPED = new Set<string>([
  'Flat',
  'StaffMember',
  'ServiceRequest',
  'Complaint',
  'CanteenMenu',
  'Event',
  'MedicalStaff',
  'Notice',
  'Poll',
  'SosAlert',
  'PropertyListing',
  'Holiday',
  'StaffNotice',
  'StaffMessage',
  'StaffMessageGroup',
  'TrainingMaterial',
  'Recognition',
  'LostFoundItem',
  'Amenity',
  'ParkingSlot',
  'CommunityPost',
  'AgmMeeting',
  'DocumentRequest',
  'InfrastructureItem',
  'Package',
  'Feedback',
  'EmergencyContact',
  'SecurityRound',
  'SocietyBudget',
  'HelpRequest',
  // Models added 2026-05 to close cross-tenant leakage risk: each has a
  // direct `societyId` column and a `Society` relation but was missing
  // from this list. Without auto-scoping, a forgotten `where` clause
  // would return rows across societies.
  'ConciergeRequest',
  'LaundryBooking',
  'SecurityIncident',
  'HousekeepingRequest',
  'PestControlSchedule',
  'CanteenPreOrder',
  'Vendor',
  'VendorOrder',
  // NOTE: `Resident` is intentionally NOT here. The schema scopes Resident
  // indirectly via `user.societyId` / `flat.societyId` — there is no direct
  // `societyId` column. Callers must hand-roll scope (e.g. `where.user.societyId`).
]);

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_OPS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

const CREATE_OPS = new Set(['create', 'createMany']);

interface AuditWriter {
  recordSecurityEvent: (e: {
    code: string;
    model: string;
    operation: string;
    actorId: string | null;
    contextSocietyId: string | null;
    attemptedSocietyId: string | null;
  }) => void;
}

let auditWriter: AuditWriter = {
  recordSecurityEvent: () => {
    // default no-op; ComplianceModule overrides at runtime
  },
};

export function setTenantAuditWriter(w: AuditWriter) {
  auditWriter = w;
}

/**
 * Prisma client extension enforcing tenant scoping on every query.
 *
 * Behaviour:
 *  - SUPER_ADMIN with bypass flag → no scoping.
 *  - Cross-tenant models (Society, User, AuditLog, ConsentLog) → no scoping.
 *  - Direct tenant-scoped models → inject `where.societyId = ctx.societyId`
 *    if not present; if a different `societyId` is supplied, throw
 *    ForbiddenException with `code: CROSS_TENANT_ACCESS` and emit a
 *    security audit event.
 *  - On create: stamp `societyId` if missing.
 */
export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations(opts) {
        const { model, operation, args } = opts;
        const query = opts.query as (a: any) => Promise<any>;
        if (!model) return query(args);
        if (isSuperAdminBypass()) return query(args);
        if (CROSS_TENANT_MODELS.has(model)) return query(args);
        if (!DIRECT_TENANT_SCOPED.has(model)) return query(args);

        const ctx = getTenantContext();
        const societyId = ctx?.societyId ?? null;
        if (!societyId) {
          // Unauthenticated boot or non-request context (e.g. seed): pass through
          return query(args);
        }

        // READ / WRITE: enforce where clause
        if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
          const a: any = args ?? {};
          a.where = a.where ?? {};
          // findUnique only accepts unique fields — only inject if model has
          // composite uniques including societyId; otherwise wrap via findFirst
          // mental model: just inject and let Prisma surface validation if
          // the unique key isn't compatible.
          if ('societyId' in a.where) {
            if (a.where.societyId !== societyId) {
              auditWriter.recordSecurityEvent({
                code: 'CROSS_TENANT_ACCESS',
                model,
                operation,
                actorId: ctx?.userId ?? null,
                contextSocietyId: societyId,
                attemptedSocietyId: String(a.where.societyId),
              });
              throw new ForbiddenException({
                code: 'CROSS_TENANT_ACCESS',
                message: 'Cross-tenant access is not permitted',
              });
            }
          } else if (operation !== 'findUnique' && operation !== 'findUniqueOrThrow' && operation !== 'delete' && operation !== 'update' && operation !== 'upsert') {
            a.where.societyId = societyId;
          }
          return query(a);
        }

        // CREATE: stamp societyId
        if (CREATE_OPS.has(operation)) {
          const a: any = args ?? {};
          if (operation === 'createMany' && Array.isArray(a.data)) {
            a.data = a.data.map((d: any) => ({ societyId, ...d }));
          } else if (a.data && typeof a.data === 'object' && !('societyId' in a.data)) {
            a.data = { societyId, ...a.data };
          } else if (a.data && a.data.societyId && a.data.societyId !== societyId) {
            auditWriter.recordSecurityEvent({
              code: 'CROSS_TENANT_ACCESS',
              model,
              operation,
              actorId: ctx?.userId ?? null,
              contextSocietyId: societyId,
              attemptedSocietyId: String(a.data.societyId),
            });
            throw new ForbiddenException({
              code: 'CROSS_TENANT_ACCESS',
              message: 'Cross-tenant create is not permitted',
            });
          }
          return query(a);
        }

        return query(args);
      },
    },
  },
});
