import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';

function setup(request: object) {
  const prisma: any = {
    housekeepingRequest: {
      findUnique: jest.fn().mockResolvedValue({ societyId: 'soc-1', ...request }),
      findFirst: jest.fn().mockResolvedValue({ societyId: 'soc-1', ...request }),
      update: jest.fn(async ({ data }: any) => ({ id: 'hk-1', ...data })),
    },
    staffMember: { findUnique: jest.fn(), findFirst: jest.fn() },
  };
  const push: any = { send: jest.fn().mockResolvedValue({ ok: true }) };
  return { prisma, push, svc: new HousekeepingService(prisma, {} as any, push) };
}

const base = { id: 'hk-1', type: 'DEEP_CLEAN', staffId: null, resident: { userId: 'u-res' } };

describe('HousekeepingService.updateStatus', () => {
  it('lets an admin assign a staff member from the society, who is notified', async () => {
    const { prisma, push, svc } = setup(base);
    prisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1', userId: 'u-staff' });

    await svc.updateStatus('hk-1', 'soc-1', { status: 'CONFIRMED', staffId: 'sm-1' } as any, {
      userId: 'admin',
      role: 'ADMIN',
    });

    expect(prisma.staffMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sm-1', societyId: 'soc-1', deletedAt: null } }),
    );
    expect(prisma.housekeepingRequest.update.mock.calls[0][0].data.staffId).toBe('sm-1');
    expect(push.send).toHaveBeenCalledWith('u-staff', expect.any(Object), expect.objectContaining({ type: 'HOUSEKEEPING_ASSIGNED' }));
  });

  it('refuses a staff member from another society', async () => {
    const { prisma, svc } = setup(base);
    prisma.staffMember.findFirst.mockResolvedValue(null);
    await expect(
      svc.updateStatus('hk-1', 'soc-1', { status: 'CONFIRMED', staffId: 'other' } as any, { userId: 'a', role: 'ADMIN' }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses staff updating a request that isn't theirs", async () => {
    const { prisma, svc } = setup({ ...base, staffId: 'sm-2' });
    prisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
    await expect(
      svc.updateStatus('hk-1', 'soc-1', { status: 'COMPLETED' } as any, { userId: 'u-staff', role: 'STAFF' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.housekeepingRequest.update).not.toHaveBeenCalled();
  });

  it('lets the assigned staff member complete it', async () => {
    const { prisma, svc } = setup({ ...base, staffId: 'sm-1' });
    prisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
    await svc.updateStatus('hk-1', 'soc-1', { status: 'COMPLETED' } as any, { userId: 'u-staff', role: 'STAFF' });
    expect(prisma.housekeepingRequest.update).toHaveBeenCalled();
  });
});
