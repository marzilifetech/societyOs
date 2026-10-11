import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffHelpService } from './staff-help.service';

function setup() {
  const prisma: any = {
    staffMember: { findUnique: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    conciergeRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'hr-1', ...data, resident: { userId: 'u-res' } })),
    },
  };
  const push: any = { send: jest.fn().mockResolvedValue({ ok: true }) };
  const s3: any = { publicUrlFor: (k: string) => (k.startsWith('https://') ? k : `https://bucket/${k}`) };
  const realtime: any = { emit: jest.fn() };
  return { prisma, push, svc: new StaffHelpService(prisma, push, s3, realtime) };
}

describe('StaffHelpService', () => {
  it('lists requests assigned to me plus open ones I can pick up — from concierge requests', async () => {
    const { prisma, svc } = setup();
    await svc.list('u-staff', 'soc-1');
    const where = prisma.conciergeRequest.findMany.mock.calls[0][0].where;
    expect(where.societyId).toBe('soc-1');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assignedStaffId: 'sm-1' }),
        { assignedStaffId: null, status: 'PENDING' },
      ]),
    );
  });

  it('accept is first-come: atomic update on an unassigned or already-mine request, then tells the resident', async () => {
    const { prisma, push, svc } = setup();
    prisma.conciergeRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.conciergeRequest.findFirst.mockResolvedValue({
      id: 'hr-1',
      assignedStaffId: 'sm-1',
      resident: { userId: 'u-res' },
    });

    await svc.accept('u-staff', 'hr-1', 'soc-1');

    const args = prisma.conciergeRequest.updateMany.mock.calls[0][0];
    expect(args.where).toEqual(
      expect.objectContaining({
        id: 'hr-1',
        societyId: 'soc-1',
        OR: [{ assignedStaffId: null }, { assignedStaffId: 'sm-1' }],
      }),
    );
    expect(args.data).toEqual({ assignedStaffId: 'sm-1', status: 'ACCEPTED' });
    expect(push.send).toHaveBeenCalledWith(
      'u-res',
      expect.any(Object),
      expect.objectContaining({ entityId: 'hr-1', status: 'ACCEPTED' }),
    );
  });

  it('says so when a colleague took it first', async () => {
    const { prisma, svc } = setup();
    prisma.conciergeRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.conciergeRequest.findFirst.mockResolvedValue({ id: 'hr-1', assignedStaffId: 'sm-2' });
    await expect(svc.accept('u-staff', 'hr-1', 'soc-1')).rejects.toThrow(ConflictException);
  });

  it("accepting again on another device is fine (it's already mine)", async () => {
    const { prisma, svc } = setup();
    prisma.conciergeRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.conciergeRequest.findFirst.mockResolvedValue({ id: 'hr-1', assignedStaffId: 'sm-1' });
    await expect(svc.accept('u-staff', 'hr-1', 'soc-1')).resolves.toEqual(
      expect.objectContaining({ id: 'hr-1' }),
    );
  });

  it("refuses to complete someone else's request", async () => {
    const { prisma, svc } = setup();
    prisma.conciergeRequest.findFirst.mockResolvedValue({ id: 'hr-1', assignedStaffId: 'sm-2', status: 'ACCEPTED' });
    await expect(svc.complete('u-staff', 'hr-1', 'soc-1', {})).rejects.toThrow(ForbiddenException);
    expect(prisma.conciergeRequest.update).not.toHaveBeenCalled();
  });

  it('completes with the photo and notes it is given (they used to be dropped)', async () => {
    const { prisma, push, svc } = setup();
    prisma.conciergeRequest.findFirst.mockResolvedValue({
      id: 'hr-1',
      assignedStaffId: 'sm-1',
      status: 'IN_PROGRESS',
      residentId: 'r1',
    });
    await svc.complete('u-staff', 'hr-1', 'soc-1', { photoUrl: 'https://cdn/x.jpg', notes: ' Delivered to door ' });
    expect(prisma.conciergeRequest.update.mock.calls[0][0].data).toEqual({
      status: 'COMPLETED',
      completionPhotoUrl: 'https://cdn/x.jpg',
      completionNotes: 'Delivered to door',
    });
    expect(push.send).toHaveBeenCalledWith('u-res', expect.any(Object), expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('decline hands my request back to the pool and ignores ones that are not mine', async () => {
    const { prisma, svc } = setup();
    prisma.conciergeRequest.findFirst.mockResolvedValueOnce({ id: 'hr-1', assignedStaffId: 'sm-1', status: 'ACCEPTED' });
    await svc.decline('u-staff', 'hr-1', 'soc-1');
    expect(prisma.conciergeRequest.update).toHaveBeenCalledWith({
      where: { id: 'hr-1' },
      data: { assignedStaffId: null, status: 'PENDING' },
    });

    prisma.conciergeRequest.findFirst.mockResolvedValueOnce({ id: 'hr-2', assignedStaffId: 'sm-9', status: 'ACCEPTED' });
    await svc.decline('u-staff', 'hr-2', 'soc-1');
    expect(prisma.conciergeRequest.update).toHaveBeenCalledTimes(1);
  });

  it('hides requests from other societies or other staff', async () => {
    const { prisma, svc } = setup();
    prisma.conciergeRequest.findFirst.mockResolvedValue(null);
    await expect(svc.get('u-staff', 'hr-1', 'other-soc')).rejects.toThrow(NotFoundException);
  });
});
