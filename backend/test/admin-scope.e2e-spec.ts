/**
 * Integration: admins are society-wide. Onboarding an admin grants full
 * access across the society — there is no block-level scoping.
 */
import { UserRole } from '@prisma/client';
import { AdminService } from '../src/modules/admin/admin.service';
import { makePrismaMock } from './helpers/prisma-mock';

function buildService(prisma: any) {
  return new AdminService(
    prisma,
    { sendToToken: jest.fn() } as any, // NotificationService
    { send: jest.fn() } as any, // PushService
    { dataExport: jest.fn() } as any, // ComplianceService
    { write: jest.fn() } as any, // AuditService
    { buildDefaultConfig: jest.fn(() => ({})) } as any, // SocietySeederService
  );
}

describe('Admin onboarding (society-wide)', () => {
  const prisma = makePrismaMock(['user']);
  const service = buildService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) => ({ id: 'u-new', ...data }));
  });

  it('creates a society-wide ADMIN with empty managedBlocks', async () => {
    await service.createBuildingAdmin('soc-1', { name: 'Asha', phone: '+919000000001' });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe(UserRole.ADMIN);
    expect(data.managedBlocks).toEqual([]);
    expect(data.societyId).toBe('soc-1');
  });

  it('listBuildingAdmins surfaces admins for the society', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', role: UserRole.ADMIN },
      { id: 'b', role: UserRole.BUILDING_ADMIN }, // legacy rows still listed
    ]);
    const rows = await service.listBuildingAdmins('soc-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: 'soc-1',
          role: { in: [UserRole.ADMIN, UserRole.BUILDING_ADMIN] },
        }),
      }),
    );
    expect(rows).toHaveLength(2);
  });
});
