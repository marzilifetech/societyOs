import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextFor(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: UserRole[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows a route with no @Roles at all', () => {
    expect(guardRequiring(undefined).canActivate(contextFor({ role: UserRole.RESIDENT }))).toBe(true);
  });

  it('allows an exact role match', () => {
    const g = guardRequiring([UserRole.ADMIN]);
    expect(g.canActivate(contextFor({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('lets BUILDING_ADMIN satisfy an ADMIN route', () => {
    const g = guardRequiring([UserRole.ADMIN]);
    expect(g.canActivate(contextFor({ role: UserRole.BUILDING_ADMIN }))).toBe(true);
  });

  it('refuses a role that does not match', () => {
    const g = guardRequiring([UserRole.ADMIN]);
    expect(g.canActivate(contextFor({ role: UserRole.RESIDENT }))).toBe(false);
  });

  /*
   * A resident promoted to admin.
   *
   * upsertAdmin sets User.role to ADMIN (or BUILDING_ADMIN when block-scoped),
   * because 300+ routes gate on the coarse role. But User.role holds only ONE
   * value, so that write silently revoked the person's access to all 117
   * @Roles(UserRole.RESIDENT) routes — they could not open their own home
   * screen or raise a complaint. Committee members are usually residents, so
   * this hit exactly the people most likely to be made admins.
   *
   * `isResident` is derived per request from the Resident row, so occupying a
   * flat stops competing with administering the society for one field.
   */
  it('lets an admin who lives here through a RESIDENT route', () => {
    const g = guardRequiring([UserRole.RESIDENT]);
    expect(g.canActivate(contextFor({ role: UserRole.ADMIN, isResident: true }))).toBe(true);
  });

  it('lets a block-scoped admin who lives here through a RESIDENT route', () => {
    const g = guardRequiring([UserRole.RESIDENT]);
    expect(g.canActivate(contextFor({ role: UserRole.BUILDING_ADMIN, isResident: true }))).toBe(true);
  });

  it('still refuses an admin who does NOT live here', () => {
    // The whole point of deriving from the Resident row: this must stay false,
    // or the fix would hand every admin a resident account they do not have.
    const g = guardRequiring([UserRole.RESIDENT]);
    expect(g.canActivate(contextFor({ role: UserRole.ADMIN, isResident: false }))).toBe(false);
  });

  it('does not let isResident widen a non-resident route', () => {
    // isResident must ONLY satisfy RESIDENT. A resident must not reach admin
    // or staff routes because they happen to occupy a flat.
    const g = guardRequiring([UserRole.ADMIN]);
    expect(g.canActivate(contextFor({ role: UserRole.RESIDENT, isResident: true }))).toBe(false);

    const staff = guardRequiring([UserRole.STAFF]);
    expect(staff.canActivate(contextFor({ role: UserRole.RESIDENT, isResident: true }))).toBe(false);
  });

  it('treats a missing isResident as not a resident', () => {
    // Older tokens and any caller that does not set the flag must fail closed.
    const g = guardRequiring([UserRole.RESIDENT]);
    expect(g.canActivate(contextFor({ role: UserRole.ADMIN }))).toBe(false);
  });

  it('refuses when there is no user at all', () => {
    const g = guardRequiring([UserRole.RESIDENT]);
    expect(g.canActivate(contextFor(undefined))).toBe(false);
  });
});
