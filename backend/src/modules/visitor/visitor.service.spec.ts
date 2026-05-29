/**
 * Visitor gate: idempotent check-in, QR expiry/revocation codes, society scope (mocked Prisma).
 */
import { ForbiddenException, GoneException } from '@nestjs/common';
import { VisitorStatus } from '@prisma/client';
import { VisitorService } from './visitor.service';
import { makePrismaMock } from '../../../test/helpers/prisma-mock';

describe('VisitorService gate flows', () => {
  const prisma = makePrismaMock(['visitor', 'resident']) as any;
  const visitorGateway = { emitVisitorArrived: jest.fn() } as any;
  let service: VisitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VisitorService(prisma, visitorGateway);
  });

  const visitorRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'v1',
    qrToken: 'ABCD1234',
    residentId: 'r1',
    status: VisitorStatus.EXPECTED,
    approvalStatus: 'APPROVED',
    validFrom: new Date(Date.now() - 3600_000),
    validUntil: new Date(Date.now() + 3600_000),
    resident: { flat: { societyId: 'socA' } },
    ...overrides,
  });

  it('checkIn is idempotent: already CHECKED_IN returns same row without update', async () => {
    const row = visitorRow({
      status: VisitorStatus.CHECKED_IN,
      validUntil: new Date(Date.now() - 3600_000),
    });
    prisma.visitor.findUnique.mockResolvedValue(row);

    const out = await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA');

    expect(out).toBe(row);
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('checkIn rejects cross-society QR with VISITOR_SOCIETY_MISMATCH', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());

    try {
      await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socB');
      fail('expected ForbiddenException');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e.getResponse()).toMatchObject({
        code: 'VISITOR_SOCIETY_MISMATCH',
      });
    }
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('checkIn after validUntil yields GoneException QR_EXPIRED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(
      visitorRow({ validUntil: new Date(Date.now() - 60_000) }),
    );

    try {
      await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA');
      fail('expected GoneException');
    } catch (e: any) {
      expect(e).toBeInstanceOf(GoneException);
      expect(e.getResponse()).toMatchObject({
        code: 'QR_EXPIRED',
      });
    }
  });

  it('checkIn rejects PENDING approval with VISITOR_PENDING_APPROVAL', async () => {
    prisma.visitor.findUnique.mockResolvedValue(
      visitorRow({ approvalStatus: 'PENDING' }),
    );

    await expect(service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_PENDING_APPROVAL' }),
    });
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('checkIn rejects REJECTED approval with VISITOR_REJECTED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(
      visitorRow({ approvalStatus: 'REJECTED' }),
    );

    await expect(service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_REJECTED' }),
    });
  });

  it('checkIn succeeds when approvalStatus is APPROVED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ approvalStatus: 'APPROVED' }));
    prisma.visitor.update.mockResolvedValue({
      ...visitorRow({ approvalStatus: 'APPROVED' }),
      status: VisitorStatus.CHECKED_IN,
    });

    await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA');

    expect(prisma.visitor.update).toHaveBeenCalled();
  });

  it('first successful checkIn updates row', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());
    prisma.visitor.update.mockResolvedValue({
      ...visitorRow(),
      status: VisitorStatus.CHECKED_IN,
      entryAt: new Date(),
      checkedInBy: 'guard-user',
    });

    await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA');

    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: expect.objectContaining({
        status: VisitorStatus.CHECKED_IN,
        checkedInBy: 'guard-user',
      }),
      include: { resident: { include: { flat: true } } },
    });
  });

  it('create rejects RESIDENT_SOCIETY_MISMATCH when JWT society ≠ flat', async () => {
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socB' },
      user: {},
    });

    try {
      await service.create('u1', 'socA', {
        name: 'Guest',
      });
      fail('expected ForbiddenException');
    } catch (e: any) {
      expect(e.getResponse()).toMatchObject({
        code: 'RESIDENT_SOCIETY_MISMATCH',
      });
    }
  });

  it('checkOut is idempotent when already CHECKED_OUT', async () => {
    const row = visitorRow({ status: VisitorStatus.CHECKED_OUT });
    prisma.visitor.findUnique.mockResolvedValue(row);

    const out = await service.checkOut('v1', 'socA');

    expect(out).toBe(row);
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('checkOut rejects when visitor not checked in', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.EXPECTED }));

    await expect(service.checkOut('v1', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CHECKOUT_INVALID_STATE' }),
    });
  });

  it('checkOut updates status on happy path', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.CHECKED_IN }));
    prisma.visitor.update.mockResolvedValue(visitorRow({ status: VisitorStatus.CHECKED_OUT }));

    await service.checkOut('v1', 'socA');

    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: expect.objectContaining({ status: VisitorStatus.CHECKED_OUT }),
    });
  });

  it('deny sets status DENIED for expected visitor', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());
    prisma.visitor.update.mockResolvedValue(visitorRow({ status: VisitorStatus.DENIED }));

    await service.deny('v1', 'socA');

    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { status: VisitorStatus.DENIED },
    });
  });

  it('findByQr rejects wrong society', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());

    await expect(service.findByQr('ABCD1234', 'socZ')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create succeeds with default validity window', async () => {
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socA' },
      user: {},
    });
    prisma.visitor.create.mockResolvedValue({ id: 'v-new', name: 'Guest' });

    const result = await service.create('u1', 'socA', { name: 'Guest', phone: '999' });

    expect(result).toMatchObject({ id: 'v-new' });
    expect(prisma.visitor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        residentId: 'r1',
        name: 'Guest',
        status: VisitorStatus.EXPECTED,
        qrToken: expect.any(String),
      }),
    });
  });

  it('create stores recurring schedule when isRecurring', async () => {
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socA' },
      user: {},
    });
    prisma.visitor.create.mockResolvedValue({ id: 'v-rec' });

    await service.create('u1', 'socA', {
      name: 'Weekly',
      isRecurring: true,
      recurringDays: ['MON', 'WED'],
      recurringUntil: '2026-12-31',
    });

    expect(prisma.visitor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isRecurring: true,
        recurringSchedule: { days: ['MON', 'WED'], until: '2026-12-31' },
      }),
    });
  });

  it('findByResident returns visitors for resident', async () => {
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socA' },
      user: {},
    });
    prisma.visitor.findMany.mockResolvedValue([{ id: 'v1' }]);

    const rows = await service.findByResident('u1', 'socA');

    expect(rows).toHaveLength(1);
    expect(prisma.visitor.findMany).toHaveBeenCalledWith({
      where: { residentId: 'r1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('findByResident rejects society mismatch', async () => {
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socB' },
      user: {},
    });

    await expect(service.findByResident('u1', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RESIDENT_SOCIETY_MISMATCH' }),
    });
  });

  it('findById throws VISITOR_NOT_FOUND when missing', async () => {
    prisma.visitor.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_NOT_FOUND' }),
    });
  });

  it('findById rejects resident society mismatch when userId provided', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socB' },
      user: {},
    });

    await expect(service.findById('v1', 'socA', 'u1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RESIDENT_SOCIETY_MISMATCH' }),
    });
  });

  it('findById rejects when resident does not own visitor', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ residentId: 'other-res' }));
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socA' },
      user: {},
    });

    await expect(service.findById('v1', 'socA', 'u1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_NOT_OWNER' }),
    });
  });

  it('findById returns visitor for owner', async () => {
    const row = visitorRow();
    prisma.visitor.findUnique.mockResolvedValue(row);
    prisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 'socA' },
      user: {},
    });

    const out = await service.findById('v1', 'socA', 'u1');
    expect(out).toBe(row);
  });

  it('findByQr throws VISITOR_NOT_FOUND when token unknown', async () => {
    prisma.visitor.findUnique.mockResolvedValue(null);

    await expect(service.findByQr('UNKNOWN', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_NOT_FOUND' }),
    });
  });

  it('findByQr rejects QR_NOT_YET_VALID before validFrom', async () => {
    prisma.visitor.findUnique.mockResolvedValue(
      visitorRow({ validFrom: new Date(Date.now() + 3600_000) }),
    );

    await expect(service.findByQr('ABCD1234', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QR_NOT_YET_VALID' }),
    });
  });

  it('findByQr allows CHECKED_IN without re-running gate', async () => {
    const row = visitorRow({
      status: VisitorStatus.CHECKED_IN,
      validUntil: new Date(Date.now() - 3600_000),
    });
    prisma.visitor.findUnique.mockResolvedValue(row);

    const out = await service.findByQr('ABCD1234', 'socA');
    expect(out).toBe(row);
  });

  it('findByQr rejects DENIED with QR_INVALIDATED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.DENIED }));

    await expect(service.findByQr('ABCD1234', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QR_INVALIDATED' }),
    });
  });

  it('findByQr rejects EXPIRED status', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.EXPIRED }));

    await expect(service.findByQr('ABCD1234', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QR_EXPIRED' }),
    });
  });

  it('findByQr rejects CHECKED_OUT with QR_VISIT_ENDED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.CHECKED_OUT }));

    await expect(service.findByQr('ABCD1234', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QR_VISIT_ENDED' }),
    });
  });

  it('checkIn throws VISITOR_NOT_FOUND for unknown QR', async () => {
    prisma.visitor.findUnique.mockResolvedValue(null);

    await expect(service.checkIn({ qrToken: 'X' }, 'guard', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_NOT_FOUND' }),
    });
  });

  it('checkOut throws VISITOR_NOT_FOUND when missing', async () => {
    prisma.visitor.findUnique.mockResolvedValue(null);

    await expect(service.checkOut('missing', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VISITOR_NOT_FOUND' }),
    });
  });

  it('deny is idempotent when already DENIED', async () => {
    const row = visitorRow({ status: VisitorStatus.DENIED });
    prisma.visitor.findUnique.mockResolvedValue(row);

    const out = await service.deny('v1', 'socA');
    expect(out).toBe(row);
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('deny rejects CHECKED_IN visitor', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ status: VisitorStatus.CHECKED_IN }));

    await expect(service.deny('v1', 'socA')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DENY_NOT_ALLOWED' }),
    });
  });

  it('approveVisitor sets approvalStatus APPROVED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow({ approvalStatus: 'PENDING' }));
    prisma.visitor.update.mockResolvedValue(visitorRow({ approvalStatus: 'APPROVED' }));

    await service.approveVisitor('v1', 'socA', 'guard-user');

    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: expect.objectContaining({
        approvalStatus: 'APPROVED',
        approvedById: 'guard-user',
      }),
      include: { resident: { include: { user: true, flat: true } } },
    });
  });

  it('rejectVisitor sets approvalStatus REJECTED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());
    prisma.visitor.update.mockResolvedValue(visitorRow({ approvalStatus: 'REJECTED' }));

    await service.rejectVisitor('v1', 'socA');

    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { approvalStatus: 'REJECTED' },
      include: { resident: { include: { user: true, flat: true } } },
    });
  });
});
