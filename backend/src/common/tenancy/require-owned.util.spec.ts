import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { requireOwnedById } from './require-owned.util';

describe('requireOwnedById', () => {
  it('returns the row when society matches', async () => {
    const row = { id: 'r1', societyId: 'soc-1', name: 'Foo' };
    const result = await requireOwnedById(
      async () => row,
      'soc-1',
      'Widget',
    );
    expect(result).toBe(row);
  });

  it('throws NotFoundException with entity name when fetcher returns null', async () => {
    await expect(
      requireOwnedById(async () => null, 'soc-1', 'Widget'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      requireOwnedById(async () => null, 'soc-1', 'Widget'),
    ).rejects.toThrow(/Widget not found/);
  });

  it('throws ForbiddenException with CROSS_TENANT_ACCESS when society differs', async () => {
    const row = { id: 'r1', societyId: 'soc-other' };
    await expect(
      requireOwnedById(async () => row, 'soc-1', 'Widget'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CROSS_TENANT_ACCESS' }),
    });
    await expect(
      requireOwnedById(async () => row, 'soc-1', 'Widget'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
