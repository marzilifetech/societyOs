import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminAccessService, type EffectiveAccess } from './admin-access.service';
import { ALL_PERMISSIONS, PERMISSIONS } from '../../common/permissions/permissions';

const OWNER_ROLE = { id: 'r-owner', key: 'owner', name: 'Owner', permissions: ALL_PERMISSIONS };
const MANAGER_ROLE = {
  id: 'r-mgr',
  key: 'manager',
  name: 'Society Manager',
  // Notably WITHOUT admins:manage — that is the escalation boundary.
  permissions: [PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_APPROVE],
};

function makeService(overrides: any = {}) {
  const prisma: any = {
    user: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    societyAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    adminRole: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { svc: new AdminAccessService(prisma), prisma };
}

const actorWith = (permissions: any[], blocks: string[] = []): EffectiveAccess => ({
  userId: 'actor-1',
  societyId: 'soc-1',
  isSuperAdmin: false,
  roleKey: 'manager',
  roleName: 'Manager',
  permissions,
  blocks,
});

const SUPER: EffectiveAccess = {
  userId: 'root',
  societyId: 'soc-1',
  isSuperAdmin: true,
  roleKey: 'super_admin',
  roleName: 'Super Admin',
  permissions: ALL_PERMISSIONS,
  blocks: [],
};

describe('AdminAccessService.resolve', () => {
  it('gives SUPER_ADMIN every permission, unscoped, without a grant row', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, societyId: 'other',
    });

    const access = await svc.resolve('u1', 'soc-1');

    expect(access.isSuperAdmin).toBe(true);
    expect(access.permissions).toEqual(ALL_PERMISSIONS);
    expect(access.blocks).toEqual([]);
    // Must not even need a SocietyAdmin row — super admin spans societies.
    expect(prisma.societyAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('returns NO permissions for a non-admin with no grant', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.STAFF, status: UserStatus.ACTIVE, societyId: 'soc-1',
    });
    prisma.societyAdmin.findUnique.mockResolvedValue(null);

    // A STAFF or RESIDENT user never has admin permissions. This is what makes
    // it safe to leave @RequirePermission off routes shared with staff.
    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  /*
   * LEGACY FALLBACK
   *
   * An earlier revision returned no permissions for an ADMIN with no grant
   * row, reasoning that User.role alone must not confer access. That is the
   * right instinct but the wrong conclusion here, and it made adopting
   * @RequirePermission unshippable: backfillExistingAdmins() only runs at
   * boot, so any admin created afterwards would 403 on their own dashboard
   * with no in-product way to recover.
   *
   * It also defends a threat this codebase does not have. Becoming ADMIN
   * already requires the privileged flows the permission system guards, and
   * those users hold full access TODAY via @Roles(ADMIN). Falling back to the
   * owner preset grants exactly the status quo — it is not an escalation.
   *
   * What keeps it honest is that an explicit grant always wins, in both
   * directions, guarded twice over — see the two tests below.
   */
  it('falls back to the owner preset for an ADMIN with no grant row', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-1', managedBlocks: [],
    });
    prisma.societyAdmin.findUnique.mockResolvedValue(null);

    const access = await svc.resolve('u1', 'soc-1');
    expect(access.roleKey).toBe('owner');
    expect(access.permissions).toEqual(expect.arrayContaining([PERMISSIONS.RESIDENTS_READ]));
    expect(access.blocks).toEqual([]);
  });

  it('falls back to block_admin, scoped to managedBlocks, for a BUILDING_ADMIN', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.BUILDING_ADMIN, status: UserStatus.ACTIVE,
      societyId: 'soc-1', managedBlocks: ['C'],
    });
    prisma.societyAdmin.findUnique.mockResolvedValue(null);

    const access = await svc.resolve('u1', 'soc-1');
    expect(access.roleKey).toBe('block_admin');
    // The fallback must carry the block scope, or a block admin would silently
    // widen to society-wide access.
    expect(access.blocks).toEqual(['C']);
    expect(access.permissions).not.toContain(PERMISSIONS.ADMINS_MANAGE);
  });

  it('does NOT fall back for an ADMIN of a DIFFERENT society', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-OTHER', managedBlocks: [],
    });
    prisma.societyAdmin.findUnique.mockResolvedValue(null);

    // Otherwise any society's admin would inherit owner rights over every
    // other society — cross-tenant escalation.
    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  it('an explicit narrow grant beats the legacy ADMIN role', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-1', managedBlocks: [],
    });
    prisma.societyAdmin.findUnique.mockResolvedValue({
      isActive: true, blocks: [], role: MANAGER_ROLE,
    });

    // Demotion must actually demote: the fallback fires only when NO row
    // exists, never to top a narrower grant back up to owner.
    const access = await svc.resolve('u1', 'soc-1');
    expect(access.roleKey).toBe('manager');
    expect(access.permissions).not.toContain(PERMISSIONS.ADMINS_MANAGE);
  });

  it('a revoked grant is not resurrected by the legacy fallback', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-1', managedBlocks: [],
    });
    // revokeAdmin soft-disables rather than deleting, precisely so the row
    // survives to block this path. (It also downgrades User.role to RESIDENT,
    // which is the second, independent barrier.)
    prisma.societyAdmin.findUnique.mockResolvedValue({
      isActive: false, blocks: [], role: OWNER_ROLE,
    });

    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  it('SUSPENDED outranks the legacy fallback', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.SUSPENDED, societyId: 'soc-1', managedBlocks: [],
    });
    prisma.societyAdmin.findUnique.mockResolvedValue(null);

    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  it('returns no permissions when the grant is deactivated', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-1',
    });
    prisma.societyAdmin.findUnique.mockResolvedValue({ isActive: false, blocks: [], role: OWNER_ROLE });

    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  it('returns no permissions when the user is SUSPENDED', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.ADMIN, status: UserStatus.SUSPENDED, societyId: 'soc-1',
    });
    prisma.societyAdmin.findUnique.mockResolvedValue({ isActive: true, blocks: [], role: OWNER_ROLE });

    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ permissions: [] });
  });

  it('carries the block scope through', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', role: UserRole.BUILDING_ADMIN, status: UserStatus.ACTIVE, societyId: 'soc-1',
    });
    prisma.societyAdmin.findUnique.mockResolvedValue({
      isActive: true, blocks: ['A', 'B'], role: MANAGER_ROLE,
    });

    await expect(svc.resolve('u1', 'soc-1')).resolves.toMatchObject({ blocks: ['A', 'B'] });
  });
});

describe('AdminAccessService.upsertAdmin — privilege escalation defences', () => {
  it('refuses to grant permissions the actor does not hold', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(OWNER_ROLE);

    // A manager trying to mint an Owner — the two-hop escalation.
    await expect(
      svc.upsertAdmin('soc-1', actorWith(MANAGER_ROLE.permissions), {
        phone: '9876543210',
        roleKey: 'owner',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('lets SUPER_ADMIN grant anything', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(OWNER_ROLE);
    prisma.user.upsert.mockResolvedValue({ id: 'u-new' });
    prisma.societyAdmin.upsert.mockResolvedValue({
      id: 'g1', blocks: [], isActive: true, role: OWNER_ROLE, user: { id: 'u-new' },
    });

    await expect(
      svc.upsertAdmin('soc-1', SUPER, { phone: '9876543210', roleKey: 'owner' }),
    ).resolves.toMatchObject({ roleKey: 'owner' });
  });

  it('refuses a block-scoped actor granting society-wide access', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);

    await expect(
      svc.upsertAdmin('soc-1', actorWith(MANAGER_ROLE.permissions, ['A']), {
        phone: '9876543210',
        roleKey: 'manager',
        blocks: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a block-scoped actor granting blocks outside their scope', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);

    await expect(
      svc.upsertAdmin('soc-1', actorWith(MANAGER_ROLE.permissions, ['A']), {
        phone: '9876543210',
        roleKey: 'manager',
        blocks: ['A', 'C'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('normalises a bare 10-digit phone to +91 and keeps User.role in step', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);
    prisma.user.upsert.mockResolvedValue({ id: 'u-new' });
    prisma.societyAdmin.upsert.mockResolvedValue({
      id: 'g1', blocks: ['A'], isActive: true, role: MANAGER_ROLE, user: { id: 'u-new' },
    });

    await svc.upsertAdmin('soc-1', SUPER, {
      phone: '9876543210',
      roleKey: 'manager',
      blocks: ['A'],
    });

    const arg = prisma.user.upsert.mock.calls[0][0];
    expect(arg.where.phone_societyId.phone).toBe('+919876543210');
    // Block scope must map to BUILDING_ADMIN so the 300+ legacy @Roles routes
    // and blockFilter() keep scoping correctly.
    expect(arg.create.role).toBe(UserRole.BUILDING_ADMIN);
    expect(arg.create.managedBlocks).toEqual(['A']);
  });

  it('rejects an unknown role key', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue(null);

    await expect(
      svc.upsertAdmin('soc-1', SUPER, { phone: '9876543210', roleKey: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminAccessService.revokeAdmin', () => {
  it('refuses to let an admin remove themselves', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'actor-1', role: OWNER_ROLE,
    });

    await expect(
      svc.revokeAdmin('soc-1', actorWith(ALL_PERMISSIONS), 'g1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to remove the last admin who can manage admins', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'someone-else', role: OWNER_ROLE,
    });
    // Everyone left lacks admins:manage -> society would be orphaned.
    prisma.societyAdmin.findMany.mockResolvedValue([{ role: MANAGER_ROLE }]);

    await expect(svc.revokeAdmin('soc-1', SUPER, 'g1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes when another admins:manage holder remains', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'someone-else', role: OWNER_ROLE,
    });
    prisma.societyAdmin.findMany.mockResolvedValue([{ role: OWNER_ROLE }]);

    await expect(svc.revokeAdmin('soc-1', SUPER, 'g1')).resolves.toMatchObject({ revoked: true });
    // Legacy @Roles routes must stop passing immediately, so User.role is
    // demoted in the same transaction.
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('refuses to remove an admin with broader access than the actor', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'someone-else', role: OWNER_ROLE,
    });

    await expect(
      svc.revokeAdmin('soc-1', actorWith(MANAGER_ROLE.permissions), 'g1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AdminAccessService.createRole', () => {
  it('rejects permissions that no route enforces', async () => {
    const { svc } = makeService();
    await expect(
      svc.createRole('soc-1', { key: 'custom', name: 'Custom', permissions: ['made:up'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminAccessService.updateRole', () => {
  it('refuses to edit a built-in preset', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue({ ...OWNER_ROLE, isSystem: true, societyId: null });

    // Presets are re-synced from code on every boot, so an "edit" would be
    // silently reverted by the next deploy.
    await expect(
      svc.updateRole('soc-1', SUPER, 'r-owner', { name: 'Renamed' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to add permissions the actor does not hold', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue({
      id: 'r-custom', isSystem: false, societyId: 'soc-1', permissions: [],
    });

    // Editing a role is another way to grant one — same boundary applies.
    await expect(
      svc.updateRole('soc-1', actorWith(MANAGER_ROLE.permissions), 'r-custom', {
        permissions: [PERMISSIONS.ADMINS_MANAGE],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects permissions no route enforces', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue({
      id: 'r-custom', isSystem: false, societyId: 'soc-1', permissions: [],
    });

    await expect(
      svc.updateRole('soc-1', SUPER, 'r-custom', { permissions: ['not:real'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminAccessService.deleteRole', () => {
  it('refuses while admins still hold the role', async () => {
    const { svc, prisma } = makeService();
    prisma.adminRole.findFirst.mockResolvedValue({
      id: 'r-custom', isSystem: false, societyId: 'soc-1',
    });
    prisma.societyAdmin.count = jest.fn().mockResolvedValue(2);

    await expect(svc.deleteRole('soc-1', 'r-custom')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminAccessService.updateAdmin', () => {
  it('refuses to modify an admin who outranks the actor', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'other', blocks: [], role: OWNER_ROLE,
    });
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);

    // Demoting someone above you is escalation-adjacent: it lets a Manager
    // strip the only Owner and take over.
    await expect(
      svc.updateAdmin('soc-1', actorWith(MANAGER_ROLE.permissions), 'g1', { roleKey: 'manager' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to demote the last admins:manage holder', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'other', blocks: [], role: OWNER_ROLE,
    });
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);
    prisma.societyAdmin.findMany.mockResolvedValue([{ role: MANAGER_ROLE }]);

    await expect(
      svc.updateAdmin('soc-1', SUPER, 'g1', { roleKey: 'manager' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates role and blocks, keeping User.role in step', async () => {
    const { svc, prisma } = makeService();
    prisma.societyAdmin.findFirst.mockResolvedValue({
      id: 'g1', userId: 'other', blocks: [], role: MANAGER_ROLE,
    });
    prisma.adminRole.findFirst.mockResolvedValue(MANAGER_ROLE);
    prisma.$transaction.mockResolvedValue([
      { id: 'g1', blocks: ['A'], isActive: true, role: MANAGER_ROLE, user: { id: 'other' } },
    ]);

    await expect(
      svc.updateAdmin('soc-1', SUPER, 'g1', { roleKey: 'manager', blocks: ['A'] }),
    ).resolves.toMatchObject({ blocks: ['A'] });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
