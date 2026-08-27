import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (requiredRoles.includes(user?.role)) return true;
    // BUILDING_ADMIN satisfies any route that requires ADMIN
    if (user?.role === UserRole.BUILDING_ADMIN && requiredRoles.includes(UserRole.ADMIN)) return true;
    // Anyone who occupies a flat satisfies a RESIDENT route, whatever their
    // User.role says. Granting admin sets User.role to ADMIN/BUILDING_ADMIN,
    // which used to lock the person out of their own resident app — the two
    // capabilities were competing for one field. `isResident` is derived per
    // request from the Resident row (see JwtStrategy.validate), so this admits
    // only people who really do live here, not admins in general.
    if (user?.isResident && requiredRoles.includes(UserRole.RESIDENT)) return true;
    return false;
  }
}
