import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  SYSTEM_ROLES,
  type Permission,
} from '../../common/permissions/permissions';

/** What a caller is allowed to do, resolved for one society. */
export interface EffectiveAccess {
  userId: string;
  societyId: string;
  /** True for SUPER_ADMIN — every permission, every society, no block scope. */
  isSuperAdmin: boolean;
  roleKey: string | null;
  roleName: string | null;
  permissions: Permission[];
  /** Empty = whole society. Non-empty = only these blocks. */
  blocks: string[];
}

@Injectable()
export class AdminAccessService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolve a user's effective access, ALWAYS from the database.
   *
   * Deliberately not cached in the JWT. Baking authorisation into the token is
   * exactly the bug that made role changes take effect only after re-login and
   * left demoted users holding their old powers until expiry (see
   * JwtStrategy.validate). Permissions change far more often than roles do, so
   * the same mistake would hurt more here: revoking access must be immediate.
   *
   * This is one indexed query on a small table, on requests that are already
   * doing real work.
   */
  async resolve(userId: string, societyId: string): Promise<EffectiveAccess> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, societyId: true, managedBlocks: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.SUPER_ADMIN) {
      // Super admin is unconditional and unscoped, by design.
      return {
        userId,
        societyId,
        isSuperAdmin: true,
        roleKey: 'super_admin',
        roleName: 'Super Admin',
        permissions: [...ALL_PERMISSIONS],
        blocks: [],
      };
    }

    const grant = await this.prisma.societyAdmin.findUnique({
      where: { userId_societyId: { userId, societyId } },
      include: { role: true },
    });

    const denied: EffectiveAccess = {
      userId,
      societyId,
      isSuperAdmin: false,
      roleKey: null,
      roleName: null,
      permissions: [],
      blocks: [],
    };

    // Suspension outranks any grant.
    if (user.status === UserStatus.SUSPENDED) return denied;

    if (grant) return grant.isActive ? this.fromGrant(userId, societyId, grant) : denied;

    // ── No grant row at all: fall back to the legacy role. ──────────────────
    //
    // This is what makes it safe to put @RequirePermission on the 300+ routes
    // that today only carry @Roles. Without it, any ADMIN lacking a grant row
    // is locked out of their own dashboard the moment a route is annotated.
    //
    // backfillExistingAdmins() only runs at boot, so it cannot cover admins
    // created afterwards — a new society's first admin, or a BUILDING_ADMIN
    // added via POST /admin/building-admins. Those users are legitimate
    // admins by UserRole and would otherwise get a 403 with no way to fix it
    // except a manual row insert.
    //
    // Note this is a fallback for a MISSING row, never for a revoked one:
    // revoking sets isActive=false and keeps the row, which is handled above.
    // So an explicit grant always wins over the legacy role, in both
    // directions.
    const legacyKey =
      user.role === UserRole.ADMIN
        ? 'owner'
        : user.role === UserRole.BUILDING_ADMIN
          ? 'block_admin'
          : null;
    if (!legacyKey || user.societyId !== societyId) return denied;

    // Read the preset from the code catalogue, not the database: seeding is
    // best-effort (AdminAccessModule.onModuleInit swallows failures), and a
    // failed seed must not silently strip every admin of their access.
    const preset = SYSTEM_ROLES.find((r) => r.key === legacyKey);
    if (!preset) return denied;

    return {
      userId,
      societyId,
      isSuperAdmin: false,
      roleKey: preset.key,
      roleName: preset.name,
      permissions: [...preset.permissions],
      blocks: user.role === UserRole.BUILDING_ADMIN ? (user.managedBlocks ?? []) : [],
    };
  }

  private fromGrant(
    userId: string,
    societyId: string,
    grant: { blocks: string[]; role: { key: string; name: string; permissions: string[] } },
  ): EffectiveAccess {
    return {
      userId,
      societyId,
      isSuperAdmin: false,
      roleKey: grant.role.key,
      roleName: grant.role.name,
      permissions: grant.role.permissions as Permission[],
      blocks: grant.blocks,
    };
  }

  async has(userId: string, societyId: string, permission: Permission): Promise<boolean> {
    const access = await this.resolve(userId, societyId);
    return access.isSuperAdmin || access.permissions.includes(permission);
  }

  /* ─────────────────────────── roles ──────────────────────────────────── */

  /** System presets + this society's custom roles. */
  async listRoles(societyId: string) {
    return this.prisma.adminRole.findMany({
      where: { OR: [{ societyId: null }, { societyId }] },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  private async resolveRoleOrThrow(societyId: string, roleKey: string) {
    const role = await this.prisma.adminRole.findFirst({
      // Prefer a society's own override of a preset key, then the preset.
      where: { key: roleKey, OR: [{ societyId }, { societyId: null }] },
      orderBy: { societyId: 'desc' },
    });
    if (!role) throw new BadRequestException(`Unknown role '${roleKey}'`);
    return role;
  }

  async createRole(
    societyId: string,
    dto: { key: string; name: string; description?: string; permissions: string[] },
  ) {
    const unknown = dto.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as Permission));
    if (unknown.length) {
      // A role granting a permission no route enforces is worse than useless —
      // it reads as access that silently does nothing.
      throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}`);
    }
    const clash = await this.prisma.adminRole.findFirst({
      where: { societyId, key: dto.key },
    });
    if (clash) throw new BadRequestException(`Role '${dto.key}' already exists for this society`);

    return this.prisma.adminRole.create({
      data: {
        societyId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
        isSystem: false,
      },
    });
  }

  /**
   * Edit a CUSTOM role. System presets are immutable.
   *
   * Presets are code-owned and re-synced on every boot (see ensureSystemRoles),
   * so an edit here would be silently reverted on the next deploy — worse than
   * refusing outright, because the change appears to work.
   */
  async updateRole(
    societyId: string,
    actor: EffectiveAccess,
    roleId: string,
    dto: { name?: string; description?: string; permissions?: string[] },
  ) {
    const role = await this.prisma.adminRole.findFirst({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem || role.societyId === null) {
      throw new BadRequestException(
        'Built-in roles cannot be edited. Duplicate it as a custom role instead.',
      );
    }
    if (role.societyId !== societyId) {
      throw new ForbiddenException('That role belongs to another society');
    }

    if (dto.permissions) {
      const unknown = dto.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as Permission));
      if (unknown.length) {
        throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}`);
      }
      // Same escalation boundary as granting: editing a role is a way to grant.
      // Without this, a Manager could add admins:manage to a role they can
      // already assign and hand themselves Owner in two steps.
      if (!actor.isSuperAdmin) {
        const held = new Set(actor.permissions);
        const excess = dto.permissions.filter((p) => !held.has(p as Permission));
        if (excess.length) {
          throw new ForbiddenException(
            `You cannot grant permissions you do not have: ${excess.join(', ')}`,
          );
        }
      }
    }

    return this.prisma.adminRole.update({
      where: { id: roleId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.permissions ? { permissions: dto.permissions } : {}),
      },
    });
  }

  /** Delete a custom role. Refused while anyone still holds it. */
  async deleteRole(societyId: string, roleId: string) {
    const role = await this.prisma.adminRole.findFirst({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem || role.societyId === null) {
      throw new BadRequestException('Built-in roles cannot be deleted');
    }
    if (role.societyId !== societyId) {
      throw new ForbiddenException('That role belongs to another society');
    }
    const inUse = await this.prisma.societyAdmin.count({ where: { roleId, isActive: true } });
    if (inUse > 0) {
      // Deleting would leave those admins pointing at nothing. Make the caller
      // move them first rather than silently stripping their access.
      throw new BadRequestException(
        `${inUse} admin${inUse === 1 ? '' : 's'} still use this role. Reassign them first.`,
      );
    }
    await this.prisma.adminRole.delete({ where: { id: roleId } });
    return { id: roleId, deleted: true };
  }

  /**
   * Change an existing admin's role and/or block scope, addressed by grant id.
   *
   * Distinct from upsertAdmin (which is keyed by phone and used for invites):
   * editing someone already in the list should not require re-typing their
   * number, and must not silently create a second person on a typo.
   */
  async updateAdmin(
    societyId: string,
    actor: EffectiveAccess,
    grantId: string,
    dto: { roleKey?: string; blocks?: string[] },
  ) {
    const grant = await this.prisma.societyAdmin.findFirst({
      where: { id: grantId, societyId },
      include: { role: true },
    });
    if (!grant) throw new NotFoundException('Admin not found for this society');

    const nextRole = dto.roleKey
      ? await this.resolveRoleOrThrow(societyId, dto.roleKey)
      : grant.role;
    const nextBlocks = dto.blocks ?? grant.blocks;

    if (!actor.isSuperAdmin) {
      const held = new Set(actor.permissions);
      // Guard BOTH directions: you may not raise someone above yourself, and
      // you may not modify someone who already outranks you.
      const excessNew = (nextRole.permissions as Permission[]).filter((p) => !held.has(p));
      const excessOld = (grant.role.permissions as Permission[]).filter((p) => !held.has(p));
      if (excessNew.length || excessOld.length) {
        throw new ForbiddenException('You cannot change an admin beyond your own access');
      }
      if (actor.blocks.length > 0) {
        if (nextBlocks.length === 0) {
          throw new ForbiddenException(
            'You manage specific blocks, so you cannot grant society-wide access',
          );
        }
        const outside = nextBlocks.filter((b) => !actor.blocks.includes(b));
        if (outside.length) {
          throw new ForbiddenException(`Blocks outside your scope: ${outside.join(', ')}`);
        }
      }
    }

    // Demoting the last admins:manage holder orphans the society just as surely
    // as removing them.
    const losesManage =
      (grant.role.permissions as Permission[]).includes(PERMISSIONS.ADMINS_MANAGE) &&
      !(nextRole.permissions as Permission[]).includes(PERMISSIONS.ADMINS_MANAGE);
    if (losesManage) await this.assertNotLastOwner(societyId, grant.id);

    const [updated] = await this.prisma.$transaction([
      this.prisma.societyAdmin.update({
        where: { id: grant.id },
        data: { roleId: nextRole.id, blocks: nextBlocks },
        include: {
          role: true,
          user: { select: { id: true, name: true, phone: true, status: true } },
        },
      }),
      this.prisma.user.update({
        where: { id: grant.userId },
        data: {
          role: nextBlocks.length > 0 ? UserRole.BUILDING_ADMIN : UserRole.ADMIN,
          managedBlocks: nextBlocks,
        },
      }),
    ]);

    return {
      id: updated.id,
      user: updated.user,
      roleKey: updated.role.key,
      roleName: updated.role.name,
      blocks: updated.blocks,
      isActive: updated.isActive,
    };
  }

  /* ────────────────────────── admin grants ────────────────────────────── */

  async listAdmins(societyId: string) {
    const grants = await this.prisma.societyAdmin.findMany({
      where: { societyId },
      include: {
        role: true,
        user: { select: { id: true, name: true, phone: true, email: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return grants.map((g) => ({
      id: g.id,
      user: g.user,
      roleKey: g.role.key,
      roleName: g.role.name,
      permissions: g.role.permissions,
      blocks: g.blocks,
      isActive: g.isActive,
      createdAt: g.createdAt,
    }));
  }

  /**
   * Add (or re-role) an admin.
   *
   * `actor` is the caller. Two escalation defences live here rather than in the
   * controller, because they must hold for EVERY path that reaches this method:
   *
   *  1. A non-super-admin cannot grant a role containing permissions they do
   *     not themselves hold. Otherwise a Manager could mint an Owner and then
   *     have that account promote them — privilege escalation in two hops.
   *  2. A block-scoped admin cannot grant society-wide access, or access to
   *     blocks outside their own scope.
   */
  async upsertAdmin(
    societyId: string,
    actor: EffectiveAccess,
    dto: { phone: string; name?: string; roleKey: string; blocks?: string[] },
  ) {
    const role = await this.resolveRoleOrThrow(societyId, dto.roleKey);
    const blocks = dto.blocks ?? [];

    if (!actor.isSuperAdmin) {
      const actorPerms = new Set(actor.permissions);
      const excess = (role.permissions as Permission[]).filter((p) => !actorPerms.has(p));
      if (excess.length) {
        throw new ForbiddenException(
          `You cannot grant permissions you do not have: ${excess.join(', ')}`,
        );
      }
      if (actor.blocks.length > 0) {
        if (blocks.length === 0) {
          throw new ForbiddenException(
            'You manage specific blocks, so you cannot grant society-wide access',
          );
        }
        const outside = blocks.filter((b) => !actor.blocks.includes(b));
        if (outside.length) {
          throw new ForbiddenException(`Blocks outside your scope: ${outside.join(', ')}`);
        }
      }
    }

    const phone = dto.phone.startsWith('+') ? dto.phone : `+91${dto.phone.replace(/\D/g, '')}`;

    // The person may not exist yet — an admin is often invited before they have
    // ever opened the app. Create them PENDING; their first OTP login activates
    // the account without changing this grant.
    const user = await this.prisma.user.upsert({
      where: { phone_societyId: { phone, societyId } },
      create: {
        phone,
        name: dto.name,
        societyId,
        role: blocks.length > 0 ? UserRole.BUILDING_ADMIN : UserRole.ADMIN,
        status: UserStatus.PENDING,
        managedBlocks: blocks,
      },
      update: {
        ...(dto.name ? { name: dto.name } : {}),
        // Keep the coarse User.role in step so the 300+ existing @Roles routes
        // and blockFilter() behave correctly without being touched.
        role: blocks.length > 0 ? UserRole.BUILDING_ADMIN : UserRole.ADMIN,
        managedBlocks: blocks,
      },
    });

    const grant = await this.prisma.societyAdmin.upsert({
      where: { userId_societyId: { userId: user.id, societyId } },
      create: {
        userId: user.id,
        societyId,
        roleId: role.id,
        blocks,
        grantedById: actor.userId,
        isActive: true,
      },
      update: { roleId: role.id, blocks, isActive: true },
      include: { role: true, user: { select: { id: true, name: true, phone: true, status: true } } },
    });

    return {
      id: grant.id,
      user: grant.user,
      roleKey: grant.role.key,
      roleName: grant.role.name,
      blocks: grant.blocks,
      isActive: grant.isActive,
    };
  }

  /**
   * Revoke a grant.
   *
   * Soft by default (isActive=false) so the audit trail of who once had access
   * survives. Also demotes User.role back to RESIDENT so the legacy @Roles
   * checks stop passing immediately — without that, revocation would be
   * invisible to every route that has not adopted permissions yet.
   */
  async revokeAdmin(societyId: string, actor: EffectiveAccess, grantId: string) {
    const grant = await this.prisma.societyAdmin.findFirst({
      where: { id: grantId, societyId },
      include: { role: true },
    });
    if (!grant) throw new NotFoundException('Admin not found for this society');

    if (grant.userId === actor.userId) {
      // Removing your own access locks you out of the screen you are standing
      // on, and if you were the last Owner, locks everyone out.
      throw new BadRequestException('You cannot remove your own admin access');
    }

    if (!actor.isSuperAdmin) {
      const actorPerms = new Set(actor.permissions);
      const excess = (grant.role.permissions as Permission[]).filter((p) => !actorPerms.has(p));
      if (excess.length) {
        throw new ForbiddenException('You cannot remove an admin with broader access than your own');
      }
    }

    await this.assertNotLastOwner(societyId, grant.id);

    await this.prisma.$transaction([
      this.prisma.societyAdmin.update({
        where: { id: grant.id },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: grant.userId },
        data: { role: UserRole.RESIDENT, managedBlocks: [] },
      }),
    ]);
    return { id: grant.id, revoked: true };
  }

  /**
   * A society must always retain at least one active admin holding
   * ADMINS_MANAGE, or nobody can ever grant access again and it needs manual
   * database surgery to recover.
   */
  private async assertNotLastOwner(societyId: string, excludingGrantId: string) {
    const actives = await this.prisma.societyAdmin.findMany({
      where: { societyId, isActive: true, id: { not: excludingGrantId } },
      include: { role: true },
    });
    const someoneCanManage = actives.some((g) =>
      (g.role.permissions as Permission[]).includes(PERMISSIONS.ADMINS_MANAGE),
    );
    if (!someoneCanManage) {
      throw new BadRequestException(
        'This is the last admin who can manage admins. Assign someone else first.',
      );
    }
  }

  /**
   * Give every pre-existing ADMIN / BUILDING_ADMIN a grant, once.
   *
   * WITHOUT THIS, SHIPPING THIS FEATURE REVOKES EVERYONE. Access now resolves
   * through SocietyAdmin; an admin who predates this table has no row, so
   * `resolve()` returns zero permissions and every `@RequirePermission` route
   * starts 403ing for people who legitimately had access yesterday.
   *
   * Mapping is deliberately conservative:
   *   ADMIN          -> owner       (they already had full access)
   *   BUILDING_ADMIN -> block_admin (scoped, carrying their managedBlocks)
   *
   * Idempotent: only creates rows for users who have none, so a re-run never
   * overwrites a role someone has since been given deliberately.
   */
  async backfillExistingAdmins(): Promise<number> {
    const [ownerRole, blockRole] = await Promise.all([
      this.prisma.adminRole.findFirst({ where: { societyId: null, key: 'owner' } }),
      this.prisma.adminRole.findFirst({ where: { societyId: null, key: 'block_admin' } }),
    ]);
    if (!ownerRole || !blockRole) return 0;

    const legacy = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.BUILDING_ADMIN] },
        adminGrants: { none: {} },
      },
      select: { id: true, societyId: true, role: true, managedBlocks: true },
    });
    if (legacy.length === 0) return 0;

    await this.prisma.societyAdmin.createMany({
      data: legacy.map((u) => ({
        userId: u.id,
        societyId: u.societyId,
        roleId: u.role === UserRole.BUILDING_ADMIN ? blockRole.id : ownerRole.id,
        blocks: u.role === UserRole.BUILDING_ADMIN ? u.managedBlocks : [],
        isActive: true,
      })),
      skipDuplicates: true,
    });
    return legacy.length;
  }

  /** Seed system role presets. Idempotent — safe to run on every boot. */
  async ensureSystemRoles() {
    for (const preset of SYSTEM_ROLES) {
      // findFirst + create/update rather than upsert: the compound unique is
      // (societyId, key) and societyId is NULL for presets. Postgres treats
      // every NULL as distinct in a unique index, and Prisma's generated
      // `societyId_key` input does not accept null at all — an upsert here
      // would either fail to compile away or silently insert a duplicate
      // preset on every boot.
      const existing = await this.prisma.adminRole.findFirst({
        where: { societyId: null, key: preset.key },
      });
      const data = {
        name: preset.name,
        description: preset.description,
        permissions: preset.permissions as string[],
      };
      if (existing) {
        // Presets are code-owned: re-sync so a deploy that adds a permission
        // actually reaches the roles that should include it.
        await this.prisma.adminRole.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.adminRole.create({
          data: { ...data, societyId: null, key: preset.key, isSystem: true },
        });
      }
    }
  }
}
