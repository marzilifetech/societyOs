import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { Permission } from '../permissions/permissions';
import { AdminAccessService } from '../../modules/admin-access/admin-access.service';

/**
 * Enforces `@RequirePermission(...)`.
 *
 * Runs alongside RolesGuard, not instead of it — a route may carry both, and
 * both must pass. Routes with no `@RequirePermission` are untouched, which is
 * what lets this ship without editing 300+ existing handlers.
 *
 * Resolution is per-request and hits the database (see AdminAccessService.
 * resolve for why it is deliberately not cached in the JWT).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private access: AdminAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.sub) throw new ForbiddenException('Not authenticated');

    // Super admin short-circuits before any lookup — unconditional by design.
    if (user.role === UserRole.SUPER_ADMIN) {
      req.access = {
        userId: user.sub,
        societyId: user.societyId,
        isSuperAdmin: true,
        roleKey: 'super_admin',
        roleName: 'Super Admin',
        permissions: required,
        blocks: [],
      };
      return true;
    }

    // A super admin acting on another society passes `societyId` explicitly;
    // everyone else is pinned to their own.
    const societyId: string | undefined = req.params?.societyId ?? user.societyId;
    if (!societyId) throw new ForbiddenException('No society context');

    const access = await this.access.resolve(user.sub, societyId);
    const missing = required.filter((p) => !access.permissions.includes(p));
    if (missing.length) {
      // Name what is missing: an opaque 403 here is the difference between a
      // one-minute fix and a support ticket.
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }

    // Hand the resolved access downstream so handlers can scope queries by
    // block without resolving it a second time.
    req.access = access;
    return true;
  }
}
