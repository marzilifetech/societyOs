import { Prisma } from '@prisma/client';
import { ComplianceService } from './compliance.service';

function setup(fakeUser: object) {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(fakeUser), update: jest.fn() },
    resident: { update: jest.fn() },
    staffMember: { update: jest.fn() },
    device: { deleteMany: jest.fn() },
  };
  // The resident's own household and personal records.
  for (const model of [
    'familyMember', 'vehicle', 'domesticAttendance', 'domesticHelpPayment', 'domesticHelp',
    'medicationDose', 'medication', 'healthRecord', 'healthVital', 'subscription',
    'documentRequest', 'feedback', 'propertyInterest', 'propertyListing', 'postLike', 'postComment',
  ]) {
    prisma[model] = { deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) };
  }
  prisma.communityPost = { updateMany: jest.fn() };
  // Every write must happen inside one transaction.
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  const consent: any = { record: jest.fn().mockResolvedValue(true) };
  const audit: any = { write: jest.fn().mockResolvedValue(true) };
  return { prisma, consent, svc: new ComplianceService(prisma, consent, audit) };
}

describe('ComplianceService.dataDelete', () => {
  it('scrubs a resident: KYC, DOB, emergency contact, secrets, devices — in one transaction', async () => {
    const { prisma, consent, svc } = setup({
      id: 'u1',
      role: 'RESIDENT',
      societyId: 's1',
      resident: { id: 'r1' },
      staffMember: null,
    });

    const out = await svc.dataDelete('u1', '127.0.0.1');

    expect(out.ok).toBe(true);
    expect(consent.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_DELETE_REQUESTED' }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const resident = prisma.resident.update.mock.calls[0][0].data;
    expect(resident).toEqual(
      expect.objectContaining({
        isAnonymised: true,
        aadhaar: null,
        aadhaarUrl: null,
        panNumber: null,
        panUrl: null,
        idProof: null,
        addressProof: null,
        dateOfBirth: null,
        emergencyContact: Prisma.DbNull,
      }),
    );
    expect(resident.deletedAt).toBeInstanceOf(Date);
    expect(prisma.device.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    // What the delete dialog promises.
    expect(prisma.familyMember.deleteMany).toHaveBeenCalledWith({ where: { residentId: 'r1' } });
    expect(prisma.vehicle.deleteMany).toHaveBeenCalledWith({ where: { residentId: 'r1' } });
    expect(prisma.documentRequest.deleteMany).toHaveBeenCalledWith({ where: { residentId: 'r1' } });
    expect(prisma.communityPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { residentId: 'r1' }, data: expect.objectContaining({ content: '' }) }),
    );
    const user = prisma.user.update.mock.calls[0][0].data;
    expect(user).toEqual(
      expect.objectContaining({
        status: 'SUSPENDED',
        name: null,
        email: null,
        dateOfBirth: null,
        fcmToken: null,
        totpSecret: null,
      }),
    );
  });

  it('deletes a staff account (used to 500: null on a Json column)', async () => {
    const { prisma, svc } = setup({
      id: 'u2',
      role: 'STAFF',
      societyId: 's1',
      resident: null,
      staffMember: { id: 'sm1' },
    });

    await expect(svc.dataDelete('u2')).resolves.toEqual(expect.objectContaining({ ok: true }));
    const staff = prisma.staffMember.update.mock.calls[0][0].data;
    expect(staff.emergencyContact).toBe(Prisma.DbNull);
    expect(staff.familyDetails).toBe(Prisma.DbNull);
    expect(staff.deletedAt).toBeInstanceOf(Date);
  });

  it('writes nothing when the transaction fails part-way', async () => {
    const { prisma, svc } = setup({ id: 'u3', role: 'STAFF', societyId: 's1', resident: null, staffMember: { id: 'sm' } });
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.dataDelete('u3')).rejects.toThrow('db down');
  });
});
