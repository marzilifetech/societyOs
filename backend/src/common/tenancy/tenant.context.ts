import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  societyId: string | null;
  userId: string | null;
  role: string | null;
  superAdminBypass?: boolean;
  /** Super-admin tenant-switch confirmation flag (re-auth) */
  reAuthConfirmed?: boolean;
  /** Request id for log correlation */
  requestId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function getSocietyId(): string | null {
  return tenantStorage.getStore()?.societyId ?? null;
}

export function isSuperAdminBypass(): boolean {
  const ctx = tenantStorage.getStore();
  return !!(ctx?.role === 'SUPER_ADMIN' && ctx?.superAdminBypass);
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}
