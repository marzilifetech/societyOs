import { SetMetadata } from '@nestjs/common';

export const AUDIT_SKIP = 'audit:skip';
export const AuditSkip = () => SetMetadata(AUDIT_SKIP, true);

export const AUDITED_UPDATE = 'audit:update';

/**
 * Marks a service method as performing an audited update. The interceptor
 * reads the `entityType` and uses the `id` route param to fetch a
 * pre-snapshot via the supplied loader.
 */
export interface AuditedUpdateMeta {
  entityType: string;
  /** Optional override for which route param contains the entity id */
  idParam?: string;
}
export const AuditedUpdate = (meta: AuditedUpdateMeta) => SetMetadata(AUDITED_UPDATE, meta);
