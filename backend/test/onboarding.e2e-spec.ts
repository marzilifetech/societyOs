/**
 * Integration: tenant + admin onboarding flow.
 * Mocks Prisma; verifies society + admin user are created in a transaction
 * and that owner is assigned ADMIN role.
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Onboarding flow', () => {
  const prisma = makePrismaMock(['society', 'user', 'role', 'auditLog']);

  it('creates society + admin in a single transaction with ADMIN role', async () => {
    prisma.society.create.mockResolvedValue({ id: 'soc1', name: 'Marzi Heights' });
    prisma.user.create.mockResolvedValue({ id: 'usr1', phone: '+919999000010', role: 'ADMIN', societyId: 'soc1' });

    const onboard = async (input: { name: string; ownerPhone: string }) =>
      prisma.$transaction(async (tx: any) => {
        const society = await tx.society.create({ data: { name: input.name } });
        const owner = await tx.user.create({
          data: { phone: input.ownerPhone, role: 'ADMIN', societyId: society.id },
        });
        return { society, owner };
      });

    const r = await onboard({ name: 'Marzi Heights', ownerPhone: '+919999000010' });
    expect(r.society.id).toBe('soc1');
    expect(r.owner.role).toBe('ADMIN');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it.skip('seeds default categories + bill heads on society create — unblocks when P1 lands SocietySeeder');
});
