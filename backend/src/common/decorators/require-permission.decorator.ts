import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions/permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Require one or more permissions on a route.
 *
 * ADDITIVE to `@Roles(...)`, never a replacement. There are 300+ `@Roles`
 * sites; rewriting them in one change would be a large, silent-failure-prone
 * blast radius on authorisation, which is the last place to take that risk.
 * A route may carry both — both must pass.
 *
 * Semantics: the caller must hold ALL listed permissions (AND). For OR, use a
 * single broader permission instead — an implicit OR in a guard is very easy to
 * misread when auditing who can do what.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
