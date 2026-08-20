import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../common/permissions/permissions';
import { AdminAccessService } from './admin-access.service';
import {
  CreateAdminRoleDto,
  UpdateAdminDto,
  UpdateAdminRoleDto,
  UpsertAdminDto,
} from './dto/admin-access.dto';

/**
 * Society admin management.
 *
 * TWO entry points on purpose:
 *
 *  • `/admin/*`          — an admin managing their OWN society. Gated by the
 *                          ADMINS_MANAGE permission, which is what makes
 *                          multi-admin self-service rather than a super-admin
 *                          bottleneck.
 *  • `/super-admin/*`    — a SUPER_ADMIN acting on ANY society, addressed by
 *                          :societyId in the path.
 *
 * Both funnel into the same service methods, so the escalation defences
 * (cannot grant beyond your own permissions, cannot exceed your block scope,
 * cannot orphan a society) are enforced once, not per-route.
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller()
export class AdminAccessController {
  constructor(private access: AdminAccessService) {}

  /**
   * What the CALLER can do, in their own society.
   *
   * This is the endpoint the admin dashboard is built from: the web app reads
   * it once at load and derives its navigation, its action buttons and its
   * block scoping from the response, instead of hardcoding a menu and hoping
   * the server agrees. A permission the caller lacks means the control is never
   * rendered — and the server still rejects it if they hand-craft the request.
   */
  @Get('admin/me/access')
  @Roles(UserRole.ADMIN, UserRole.BUILDING_ADMIN, UserRole.SUPER_ADMIN)
  myAccess(@CurrentUser() user: JwtPayload) {
    return this.access.resolve(user.sub, user.societyId!);
  }

  /** The permission catalogue, grouped for display. Drives the role editor. */
  @Get('admin/permissions')
  @Roles(UserRole.ADMIN, UserRole.BUILDING_ADMIN, UserRole.SUPER_ADMIN)
  catalogue() {
    return { groups: PERMISSION_GROUPS };
  }

  /* ─────────────── own society (needs admins:manage) ──────────────────── */

  @Get('admin/roles')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  listRoles(@CurrentUser() user: JwtPayload) {
    return this.access.listRoles(user.societyId!);
  }

  @Post('admin/roles')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  createRole(@CurrentUser() user: JwtPayload, @Body() dto: CreateAdminRoleDto) {
    return this.access.createRole(user.societyId!, dto);
  }

  @Get('admin/admins')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  listAdmins(@CurrentUser() user: JwtPayload) {
    return this.access.listAdmins(user.societyId!);
  }

  @Post('admin/admins')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  async addAdmin(@CurrentUser() user: JwtPayload, @Body() dto: UpsertAdminDto) {
    const actor = await this.access.resolve(user.sub, user.societyId!);
    return this.access.upsertAdmin(user.societyId!, actor, dto);
  }

  @Patch('admin/roles/:roleId')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  async updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateAdminRoleDto,
  ) {
    const actor = await this.access.resolve(user.sub, user.societyId!);
    return this.access.updateRole(user.societyId!, actor, roleId, dto);
  }

  @Delete('admin/roles/:roleId')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  deleteRole(@CurrentUser() user: JwtPayload, @Param('roleId') roleId: string) {
    return this.access.deleteRole(user.societyId!, roleId);
  }

  @Patch('admin/admins/:grantId')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  async updateAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('grantId') grantId: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const actor = await this.access.resolve(user.sub, user.societyId!);
    return this.access.updateAdmin(user.societyId!, actor, grantId, dto);
  }

  @Delete('admin/admins/:grantId')
  @RequirePermission(PERMISSIONS.ADMINS_MANAGE)
  async removeAdmin(@CurrentUser() user: JwtPayload, @Param('grantId') grantId: string) {
    const actor = await this.access.resolve(user.sub, user.societyId!);
    return this.access.revokeAdmin(user.societyId!, actor, grantId);
  }

  /* ─────────────── super admin, any society ───────────────────────────── */

  @Get('super-admin/societies/:societyId/admins')
  @Roles(UserRole.SUPER_ADMIN)
  listAnyAdmins(@Param('societyId') societyId: string) {
    return this.access.listAdmins(societyId);
  }

  @Get('super-admin/societies/:societyId/roles')
  @Roles(UserRole.SUPER_ADMIN)
  listAnyRoles(@Param('societyId') societyId: string) {
    return this.access.listRoles(societyId);
  }

  @Post('super-admin/societies/:societyId/admins')
  @Roles(UserRole.SUPER_ADMIN)
  async addAnyAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('societyId') societyId: string,
    @Body() dto: UpsertAdminDto,
  ) {
    const actor = await this.access.resolve(user.sub, societyId);
    return this.access.upsertAdmin(societyId, actor, dto);
  }

  @Post('super-admin/societies/:societyId/roles')
  @Roles(UserRole.SUPER_ADMIN)
  createAnyRole(@Param('societyId') societyId: string, @Body() dto: CreateAdminRoleDto) {
    return this.access.createRole(societyId, dto);
  }

  @Patch('super-admin/societies/:societyId/roles/:roleId')
  @Roles(UserRole.SUPER_ADMIN)
  async updateAnyRole(
    @CurrentUser() user: JwtPayload,
    @Param('societyId') societyId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateAdminRoleDto,
  ) {
    const actor = await this.access.resolve(user.sub, societyId);
    return this.access.updateRole(societyId, actor, roleId, dto);
  }

  @Delete('super-admin/societies/:societyId/roles/:roleId')
  @Roles(UserRole.SUPER_ADMIN)
  deleteAnyRole(@Param('societyId') societyId: string, @Param('roleId') roleId: string) {
    return this.access.deleteRole(societyId, roleId);
  }

  @Patch('super-admin/societies/:societyId/admins/:grantId')
  @Roles(UserRole.SUPER_ADMIN)
  async updateAnyAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('societyId') societyId: string,
    @Param('grantId') grantId: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const actor = await this.access.resolve(user.sub, societyId);
    return this.access.updateAdmin(societyId, actor, grantId, dto);
  }

  @Delete('super-admin/societies/:societyId/admins/:grantId')
  @Roles(UserRole.SUPER_ADMIN)
  async removeAnyAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('societyId') societyId: string,
    @Param('grantId') grantId: string,
  ) {
    const actor = await this.access.resolve(user.sub, societyId);
    return this.access.revokeAdmin(societyId, actor, grantId);
  }
}
