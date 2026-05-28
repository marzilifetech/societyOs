import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getTenantContext } from '../tenancy/tenant.context';

/**
 * Returns the EFFECTIVE society id for the current request.
 *
 * - For a regular caller, this matches the JWT `societyId` (their home society).
 * - For a SUPER_ADMIN who has switched tenants via `X-Society-Id`, this is
 *   the switched value (set by `TenantMiddleware` into `tenantStorage`).
 *
 * Reading from `tenantStorage` first is the key correctness invariant: any
 * handler using `@SocietyId()` must scope by the *effective* tenant the
 * caller is acting on, NOT the actor's home society. Mixing the two was the
 * 2026-05 cross-tenant leak on /admin/residents/:id/approve.
 *
 * Falls back to `request.user.societyId` (JWT) when `tenantStorage` is
 * unpopulated — that path is hit in unit tests that bypass the middleware.
 *
 * If you specifically need the actor's HOME society (e.g. for audit logs),
 * read `request.user.societyId` directly via `@CurrentUser()`.
 */
export const SocietyId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const fromCtx = getTenantContext()?.societyId;
  if (fromCtx) return fromCtx;
  const request = ctx.switchToHttp().getRequest();
  return request.user?.societyId;
});
