/**
 * Integration: admin scoping — a society admin (ADMIN) spans the whole
 * society; a building admin (BUILDING_ADMIN) is limited to selected blocks.
 */
import { BadRequestException } from '@nestjs/common';
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

describe('Admin scoping (society vs building)', () => {
  const prisma = makePrismaMock(['user']);
  const service = buildService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) => ({ id: 'u-new', ...data }));
  });

  it('scope=SOCIETY → role ADMIN with empty managedBlocks', async () => {
    await service.createBuildingAdmin('soc-1', {
      name: 'Asha',
      phone: '+919000000001',
      managedBlocks: ['A'],
      scope: 'SOCIETY',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe(UserRole.ADMIN);
    expect(data.managedBlocks).toEqual([]);
  });

  it('scope=BUILDINGS with blocks → role BUILDING_ADMIN scoped to those blocks', async () => {
    await service.createBuildingAdmin('soc-1', {
      name: 'Ravi',
      phone: '+919000000002',
      managedBlocks: ['A', 'B'],
      scope: 'BUILDINGS',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe(UserRole.BUILDING_ADMIN);
    expect(data.managedBlocks).toEqual(['A', 'B']);
  });

  it('scope=BUILDINGS without blocks is rejected', async () => {
    await expect(
      service.createBuildingAdmin('soc-1', {
        name: 'Ravi',
        phone: '+919000000003',
        managedBlocks: [],
        scope: 'BUILDINGS',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('listBuildingAdmins surfaces both ADMIN and BUILDING_ADMIN roles', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', role: UserRole.ADMIN, managedBlocks: [] },
      { id: 'b', role: UserRole.BUILDING_ADMIN, managedBlocks: ['A'] },
    ]);
    const rows = await service.listBuildingAdmins('soc-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: [UserRole.ADMIN, UserRole.BUILDING_ADMIN] },
        }),
      }),
    );
    expect(rows.map((r: any) => r.role)).toEqual([UserRole.ADMIN, UserRole.BUILDING_ADMIN]);
  });
});
