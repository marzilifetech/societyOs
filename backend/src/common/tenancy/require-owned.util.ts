import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Find a row by id and assert it belongs to the caller's society. Use this
 * everywhere a service does `prisma.X.findUnique({ where: { id } })` on a
 * direct-tenant-scoped model — the Prisma tenant extension cannot auto-scope
 * findUnique/update/delete/upsert (the where must be a unique key). This
 * helper makes the scope explicit and consistent.
 *
 * Throws ForbiddenException with code CROSS_TENANT_ACCESS on mismatch.
 * Throws NotFoundException with the caller-supplied entity name on miss.
 *
 * @example
 *   const booking = await requireOwnedById(
 *     () => prisma.laundryBooking.findUnique({ where: { id } }),
 *     societyId,
 *     'Booking',
 *   );
 */
export async function requireOwnedById<T extends { societyId: string }>(
  fetcher: () => Promise<T | null>,
  societyId: string,
  entityName: string,
): Promise<T> {
  const row = await fetcher();
  if (!row) {
    throw new NotFoundException(`${entityName} not found`);
  }
  if (row.societyId !== societyId) {
    throw new ForbiddenException({
      code: 'CROSS_TENANT_ACCESS',
      message: `${entityName} belongs to another society`,
    });
  }
  return row;
}
