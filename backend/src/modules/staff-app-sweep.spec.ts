/**
 * Regression tests for the 2026-09 staff-app sweep.
 *
 * Two themes run through these:
 *   1. Notification action buttons pointed at routes that did not exist, and
 *      the app swallowed the 404 — so the failure was completely invisible.
 *   2. Several endpoints accepted work from the staff app and threw it away,
 *      either by rejecting the request (forbidNonWhitelisted) or by declaring
 *      no body at all.
 */
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceRequestService } from './service-request/service-request.service';
import { HelpRequestService } from './help-request/help-request.service';
import { LaundryService } from './laundry/laundry.service';
import { HousekeepingService } from './housekeeping/housekeeping.service';

const noopPush = { send: jest.fn().mockResolvedValue({ ok: true }), sendToSociety: jest.fn() } as any;
const noopGateway = { emitToSociety: jest.fn(), emitToUser: jest.fn() } as any;
const noopNotify = { notifyUser: jest.fn(), sendToToken: jest.fn() } as any;
const noopS3 = { getPresignedUploadUrl: jest.fn() } as any;

function srService(prisma: any) {
  return new ServiceRequestService(prisma, noopS3, noopGateway, noopNotify, noopPush);
}

// ── Task accept / decline: the "Accept" button on a task push ──────────────
describe('ServiceRequestService.acceptTask', () => {
  const base = {
    id: 'sr-1',
    societyId: 'soc-1',
    residentId: 'res-1',
    category: 'Plumbing',
    assignedToIds: ['sm-1'],
    status: 'ASSIGNED',
    acceptedAt: null,
    deletedAt: null,
  };

  const makePrisma = (sr: any = base) => ({
    staffMember: {
      findUnique: jest.fn().mockResolvedValue({ id: 'sm-1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'sm-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    serviceRequest: {
      findUnique: jest.fn().mockResolvedValue(sr),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...sr, ...data })),
    },
    resident: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-res' }) },
  });

  it('stamps acceptedAt and tells the resident their request was picked up', async () => {
    const prisma: any = makePrisma();
    const res: any = await srService(prisma).acceptTask('sr-1', 'u-staff', 'soc-1');
    expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acceptedAt: expect.any(Date) }) }),
    );
    expect(res.acceptedAt).toBeInstanceOf(Date);
  });

  it('is idempotent — the same push reaches every device the staff member owns', async () => {
    const prisma: any = makePrisma({ ...base, acceptedAt: new Date('2026-09-01') });
    await srService(prisma).acceptTask('sr-1', 'u-staff', 'soc-1');
    expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
  });

  it('refuses a task that is not assigned to this staff member', async () => {
    const prisma: any = makePrisma({ ...base, assignedToIds: ['someone-else'] });
    await expect(srService(prisma).acceptTask('sr-1', 'u-staff', 'soc-1')).rejects.toThrow(ForbiddenException);
  });

  it('refuses a task from another society', async () => {
    const prisma: any = makePrisma({ ...base, societyId: 'other' });
    await expect(srService(prisma).acceptTask('sr-1', 'u-staff', 'soc-1')).rejects.toThrow(ForbiddenException);
  });

  it('refuses to accept a task that is no longer ASSIGNED', async () => {
    const prisma: any = makePrisma({ ...base, status: 'COMPLETED' });
    await expect(srService(prisma).acceptTask('sr-1', 'u-staff', 'soc-1')).rejects.toThrow(ConflictException);
  });

  it('returns the task to the admin queue when the last assignee declines', async () => {
    const prisma: any = makePrisma();
    await srService(prisma).rejectTask('sr-1', 'u-staff', 'soc-1', 'On another job');
    expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedToIds: [],
          status: 'PENDING',
          rejectedReason: 'On another job',
        }),
      }),
    );
  });

  it('keeps it ASSIGNED when other staff remain on it', async () => {
    const prisma: any = makePrisma({ ...base, assignedToIds: ['sm-1', 'sm-2'] });
    await srService(prisma).rejectTask('sr-1', 'u-staff', 'soc-1');
    expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToIds: ['sm-2'], status: 'ASSIGNED' }),
      }),
    );
  });
});

// ── Help-request decline: the "Decline" button had no route at all ─────────
describe('HelpRequestService.declineHelpRequest', () => {
  const makePrisma = (sr: any) => ({
    staffMember: { findUnique: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    serviceRequest: {
      findUnique: jest.fn().mockResolvedValue(sr),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...sr, ...data })),
    },
  });
  const svc = (prisma: any) => new HelpRequestService(prisma, noopGateway, noopS3);

  it('unassigns the staff member and reopens the request', async () => {
    const prisma: any = makePrisma({
      id: 'hr-1', societyId: 'soc-1', assignedToIds: ['sm-1'], status: 'ASSIGNED', acceptedAt: new Date(),
    });
    await svc(prisma).declineHelpRequest('u-staff', 'hr-1', 'soc-1');
    expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToIds: [], status: 'PENDING', acceptedAt: null }),
      }),
    );
  });

  it('is a no-op when it is not theirs — the push hits every device', async () => {
    const prisma: any = makePrisma({
      id: 'hr-1', societyId: 'soc-1', assignedToIds: ['other'], status: 'ASSIGNED',
    });
    await svc(prisma).declineHelpRequest('u-staff', 'hr-1', 'soc-1');
    expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
  });
});

// ── Laundry pickup: the endpoint declared no body, so evidence was dropped ─
describe('LaundryService.markPickedUp', () => {
  const makePrisma = () => ({
    laundryBooking: {
      findUnique: jest.fn().mockResolvedValue({ id: 'lb-1', societyId: 'soc-1', residentId: 'r-1' }),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lb-1', ...data })),
    },
    resident: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-1' }) },
  });

  it('stores the pickup photo and the counted garments', async () => {
    const prisma: any = makePrisma();
    await new LaundryService(prisma, noopS3, noopPush).markPickedUp('lb-1', 'soc-1', {
      photoUrl: 'https://cdn/x.jpg',
      garmentCount: 12,
    });
    const data = prisma.laundryBooking.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ pickupPhotoUrl: 'https://cdn/x.jpg', itemCount: 12 });
  });

  it('stamps pickedUpAt, which it never used to do', async () => {
    const prisma: any = makePrisma();
    await new LaundryService(prisma, noopS3, noopPush).markPickedUp('lb-1', 'soc-1');
    expect(prisma.laundryBooking.update.mock.calls[0][0].data.pickedUpAt).toBeInstanceOf(Date);
  });

  it('still records the pickup when no photo or count was captured', async () => {
    const prisma: any = makePrisma();
    await new LaundryService(prisma, noopS3, noopPush).markPickedUp('lb-1', 'soc-1', {});
    const data = prisma.laundryBooking.update.mock.calls[0][0].data;
    // Refusing the pickup outright would leave the booking stuck.
    expect(data.status).toBe('PICKED_UP');
    expect(data.pickupPhotoUrl).toBeUndefined();
  });

  it('ignores a nonsensical garment count rather than writing it', async () => {
    const prisma: any = makePrisma();
    await new LaundryService(prisma, noopS3, noopPush).markPickedUp('lb-1', 'soc-1', { garmentCount: 0 });
    expect(prisma.laundryBooking.update.mock.calls[0][0].data.itemCount).toBeUndefined();
  });
});

// ── Housekeeping completion: 400'd on the photos it was sent ───────────────
describe('HousekeepingService.updateStatus', () => {
  const makePrisma = (req: any = { id: 'hk-1', societyId: 'soc-1', completedAt: null, resident: { userId: 'u-1' } }) => ({
    housekeepingRequest: {
      findFirst: jest.fn().mockResolvedValue(req),
      findUnique: jest.fn().mockResolvedValue(req),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...req, ...data })),
    },
  });

  it('persists the before/after photos and the completion note', async () => {
    const prisma: any = makePrisma();
    await new HousekeepingService(prisma, noopS3, noopPush).updateStatus('hk-1', 'soc-1', {
      status: 'COMPLETED' as any,
      beforePhotoUrl: 'https://cdn/before.jpg',
      afterPhotoUrl: 'https://cdn/after.jpg',
      notes: 'Balcony done too',
    });
    const data = prisma.housekeepingRequest.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'COMPLETED',
      beforePhotoUrl: 'https://cdn/before.jpg',
      afterPhotoUrl: 'https://cdn/after.jpg',
      completionNotes: 'Balcony done too',
    });
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('never wipes captured photos on a later status change', async () => {
    const prisma: any = makePrisma();
    await new HousekeepingService(prisma, noopS3, noopPush).updateStatus('hk-1', 'soc-1', {
      status: 'IN_PROGRESS' as any,
    });
    const data = prisma.housekeepingRequest.update.mock.calls[0][0].data;
    expect('beforePhotoUrl' in data).toBe(false);
    expect('afterPhotoUrl' in data).toBe(false);
  });
});
