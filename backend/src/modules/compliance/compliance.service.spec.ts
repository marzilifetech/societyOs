import { ComplianceService } from './compliance.service';

describe('ComplianceService.dataDelete', () => {
  it('anonymises SOS + complaints, soft-deletes resident, scrubs user', async () => {
    const calls: any[] = [];
    const fakeUser = {
      id: 'u1',
      role: 'RESIDENT',
      societyId: 's1',
      resident: { id: 'r1' },
      staffMember: null,
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(fakeUser),
        update: jest.fn().mockImplementation((a) => {
          calls.push(['user.update', a]);
          return a;
        }),
      },
      resident: {
        update: jest.fn().mockImplementation((a) => {
          calls.push(['resident.update', a]);
          return a;
        }),
      },
      staffMember: { update: jest.fn() },
      sosAlert: {
        updateMany: jest.fn().mockImplementation(async (a) => {
          calls.push(['sosAlert.updateMany', a]);
          return { count: 1 };
        }),
      },
      complaint: {
        updateMany: jest.fn().mockImplementation(async (a) => {
          calls.push(['complaint.updateMany', a]);
          return { count: 1 };
        }),
      },
    };
    const consent: any = { record: jest.fn().mockResolvedValue(true) };
    const audit: any = { write: jest.fn().mockResolvedValue(true) };

    const svc = new ComplianceService(prisma, consent, audit);
    const out = await svc.dataDelete('u1', '127.0.0.1');

    expect(out.ok).toBe(true);
    expect(consent.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_DELETE_REQUESTED' }),
    );
    expect(prisma.sosAlert.updateMany).toHaveBeenCalled();
    expect(prisma.complaint.updateMany).toHaveBeenCalled();
    const residentUpdate = calls.find((c) => c[0] === 'resident.update');
    expect(residentUpdate[1].data).toEqual(
      expect.objectContaining({
        isAnonymised: true,
        aadhaar: null,
        panNumber: null,
      }),
    );
    expect(residentUpdate[1].data.deletedAt).toBeInstanceOf(Date);
    const userUpdate = calls.find((c) => c[0] === 'user.update');
    expect(userUpdate[1].data.status).toBe('SUSPENDED');
    expect(userUpdate[1].data.totpSecret).toBeNull();
  });
});
