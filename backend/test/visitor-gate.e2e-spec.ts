/**
 * Visitor gate: idempotent check-in, QR expiry/revocation codes, society scope (mocked Prisma).
 */
import { ForbiddenException, GoneException } from '@nestjs/common';
import { VisitorStatus } from '@prisma/client';
import { VisitorService } from '../src/modules/visitor/visitor.service';
import { makePrismaMock } from './helpers/prisma-mock';

describe('Visitor gate (VisitorService)', () => {
  const prisma = makePrismaMock(['visitor', 'resident']) as any;
  let service: VisitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VisitorService(prisma);
  });

  const visitorRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'v1',
    qrToken: 'ABCD1234',
    residentId: 'r1',
    status: VisitorStatus.EXPECTED,
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

    await expect(
      service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socB'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VISITOR_SOCIETY_MISMATCH',
      }),
    });
    expect(prisma.visitor.update).not.toHaveBeenCalled();
  });

  it('checkIn after validUntil yields GoneException QR_EXPIRED', async () => {
    prisma.visitor.findUnique.mockResolvedValue(
      visitorRow({ validUntil: new Date(Date.now() - 60_000) }),
    );

    await expect(
      service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA'),
    ).rejects.toBeInstanceOf(GoneException);
    try {
      await service.checkIn({ qrToken: 'ABCD1234' }, 'guard-user', 'socA');
    } catch (e: any) {
      expect(e.getResponse()).toMatchObject({
        code: 'QR_EXPIRED',
      });
    }
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

    await expect(
      service.create('u1', 'socA', {
        name: 'Guest',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RESIDENT_SOCIETY_MISMATCH',
      }),
    });
  });

  it('findByQr rejects wrong society before expiry logic', async () => {
    prisma.visitor.findUnique.mockResolvedValue(visitorRow());

    await expect(service.findByQr('ABCD1234', 'socZ')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
