import { JwtPayload } from '../decorators/current-user.decorator';

/**
 * Returns a Prisma `where` fragment that scopes a query to the blocks managed
 * by a BUILDING_ADMIN. For ADMIN / SUPER_ADMIN it returns `{}` (no restriction).
 *
 * Usage (example – service-requests):
 *   const filter = blockFilter(user);
 *   prisma.serviceRequest.findMany({ where: { ...societyFilter, ...filter } })
 *
 * The fragment targets `flat.block` via a nested relation, so the calling query
 * must include `flat` in the relation path.  For models where the path differs,
 * callers should build the condition manually using `getBlockList(user)`.
 */
export function blockFilter(user: JwtPayload): Record<string, any> {
  if (user.role !== 'BUILDING_ADMIN') return {};
  const blocks = user.managedBlocks ?? [];
  if (blocks.length === 0) return {};
  return { flat: { block: { in: blocks } } };
}

/**
 * Returns the list of allowed blocks for a BUILDING_ADMIN, or `null` for
 * admins who should see everything.
 */
export function getBlockList(user: JwtPayload): string[] | null {
  if (user.role !== 'BUILDING_ADMIN') return null;
  const blocks = user.managedBlocks ?? [];
  return blocks.length > 0 ? blocks : null;
}
