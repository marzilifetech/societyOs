/**
 * A resident can also be a society admin.
 *
 * `User.role` holds exactly ONE value, so promoting a resident to admin
 * overwrites RESIDENT with ADMIN. Committee members are almost always residents,
 * so any branch that keys personalisation on `role` silently strips their
 * resident life: their own bookings, their own event registrations, their own
 * requests. These tests pin the rule — personalisation keys on `isResident`
 * (a fact about occupying a flat), scope-widening keys on `role`.
 */
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

function guardFor(requiredRoles: UserRole[] | undefined, user: Record<string, unknown>) {
  const reflector: any = {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? requiredRoles : undefined),
  };
  const ctx: any = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return new RolesGuard(reflector).canActivate(ctx);
}

describe('RolesGuard — resident who is also an admin', () => {
  it('lets an ADMIN who occupies a flat through a RESIDENT-only route', () => {
    expect(guardFor([UserRole.RESIDENT], { role: UserRole.ADMIN, isResident: true })).toBe(true);
  });

  it('lets a BUILDING_ADMIN resident through a RESIDENT-only route', () => {
    expect(guardFor([UserRole.RESIDENT], { role: UserRole.BUILDING_ADMIN, isResident: true })).toBe(true);
  });

  it('still refuses an admin who does NOT live in the society', () => {
    // The widening must be narrow: it admits people who really occupy a flat,
    // never admins in general.
    expect(guardFor([UserRole.RESIDENT], { role: UserRole.ADMIN, isResident: false })).toBe(false);
  });

  it('never lets a plain resident into an ADMIN route', () => {
    // The widening is one-directional. The reverse would be privilege escalation.
    expect(guardFor([UserRole.ADMIN], { role: UserRole.RESIDENT, isResident: true })).toBe(false);
    expect(guardFor([UserRole.SUPER_ADMIN], { role: UserRole.ADMIN, isResident: true })).toBe(false);
  });

  it('keeps BUILDING_ADMIN satisfying ADMIN routes', () => {
    expect(guardFor([UserRole.ADMIN], { role: UserRole.BUILDING_ADMIN })).toBe(true);
  });

  it('allows any authenticated user when a route declares no roles', () => {
    expect(guardFor(undefined, { role: UserRole.RESIDENT })).toBe(true);
  });

  it('refuses when there is no user on the request', () => {
    expect(guardFor([UserRole.RESIDENT], undefined as any)).toBe(false);
  });
});
