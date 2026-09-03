/**
 * Regression tests for the 2026-09 defect sweep, module by module.
 * Each block names the report it closes.
 */
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { NoticeService } from './notice/notice.service';
import { MedicalService } from './medical/medical.service';
import { AgmService } from './agm/agm.service';
import { ParkingService } from './parking/parking.service';
import { WalletService } from './wallet/wallet.service';
import { ConciergeService } from './concierge/concierge.service';
import { InfrastructureService } from './infrastructure/infrastructure.service';
import { SocietyService } from './society/society.service';
import { normaliseConciergeType } from './concierge/dto/concierge.dto';
import { normaliseVendorCategory, VendorCategory } from './vendor/dto/create-vendor.dto';
import { resolveLeaveFields } from './staff/dto/staff.dto';

const noopPush = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
} as any;

// ── Report 14: "Poll is still displayed even after deadline has been reached"
describe('NoticeService.getAllPolls', () => {
  it('derives ACTIVE/CLOSED from the deadline and exposes totalVotes', async () => {
    const prisma: any = {
      poll: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', question: 'Open', options: ['a', 'b'], deadline: new Date(Date.now() + 86_400_000), _count: { votes: 4 } },
          { id: 'p2', question: 'Expired', options: ['a'], deadline: new Date(Date.now() - 86_400_000), _count: { votes: 9 } },
        ]),
      },
    };
    const polls = await new NoticeService(prisma, {} as any, noopPush, { send: jest.fn() } as any).getAllPolls('soc-1');

    // The admin screen gates its "Close Poll" button on status === 'ACTIVE'
    // and prints `totalVotes`; neither field existed before.
    expect(polls[0]).toMatchObject({ status: 'ACTIVE', isClosed: false, totalVotes: 4 });
    expect(polls[1]).toMatchObject({ status: 'CLOSED', isClosed: true, totalVotes: 9 });
  });
});

// ── Report 16: "Editing doctor information failure"
describe('MedicalService.updateMedicalStaff', () => {
  const makePrisma = (existing: any = { id: 'd1', societyId: 'soc-1', schedule: { availableDays: ['Mon'], timeSlots: ['09:00'] } }) => ({
    medicalStaff: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data })),
    },
  });

  it('routes availableDays into the schedule JSON instead of a non-existent column', async () => {
    const prisma: any = makePrisma();
    await new MedicalService(prisma, noopPush).updateMedicalStaff('d1', 'soc-1', {
      name: ' Dr Rao ',
      designation: 'Cardiologist',
      availableDays: ['Tue', 'Thu'],
    });

    const data = prisma.medicalStaff.update.mock.calls[0][0].data;
    // Would previously have been passed straight to Prisma -> "Unknown argument".
    expect(data.availableDays).toBeUndefined();
    expect(data.schedule).toEqual({ availableDays: ['Tue', 'Thu'], timeSlots: ['09:00'] });
    expect(data.name).toBe('Dr Rao');
  });

  it('never writes an unknown key even when the client sends one', async () => {
    const prisma: any = makePrisma();
    await new MedicalService(prisma, noopPush).updateMedicalStaff('d1', 'soc-1', { hackedColumn: 1, name: 'X' } as any);
    expect(prisma.medicalStaff.update.mock.calls[0][0].data).toEqual({ name: 'X', schedule: { availableDays: ['Mon'], timeSlots: ['09:00'] } });
  });

  it('refuses a doctor from another society', async () => {
    const prisma: any = makePrisma(null);
    await expect(new MedicalService(prisma, noopPush).updateMedicalStaff('d1', 'soc-1', { name: 'X' })).rejects.toThrow(NotFoundException);
  });
});

// ── Report 6: "Emergency SOS alert is not visible in the medical section"
describe('MedicalService.getSosLog', () => {
  it('returns the acknowledged/resolved booleans the table renders', async () => {
    const prisma: any = {
      sosAlert: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', residentId: 'u1', createdAt: new Date(), acknowledgedBy: 'u9', acknowledgedAt: new Date(), resolvedAt: new Date(), responseTimeSecs: 120, status: 'RESOLVED', note: null, resident: { name: 'Asha' } },
          { id: 's2', residentId: 'u2', createdAt: new Date(), acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, responseTimeSecs: null, status: 'ACTIVE', note: null, resident: { name: 'Bala' } },
        ]),
      },
      resident: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1', flat: { block: 'A', number: '101' } }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u9', name: 'Guard' }]) },
    };

    const rows = await new MedicalService(prisma, noopPush).getSosLog('soc-1');

    expect(rows[0]).toMatchObject({ residentName: 'Asha', flat: 'A-101', acknowledged: true, resolved: true, acknowledgedBy: 'Guard' });
    expect(rows[1]).toMatchObject({ acknowledged: false, resolved: false });
    // Rows with no resident profile must still render, not blow up.
    expect(rows[1].flat).toBe('—');
  });
});

// ── Report 11: "AGM Management - Cannot create a meeting" (no endpoint existed)
describe('AgmService.createMeeting', () => {
  const makePrisma = () => ({
    agmMeeting: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'm1', ...data, date: data.date, resolutions: [] }),
      ),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  });

  it('creates a meeting and notifies residents', async () => {
    const prisma: any = makePrisma();
    const svc = new AgmService(prisma, noopPush);
    const meeting: any = await svc.createMeeting('soc-1', {
      title: '  AGM 2026  ',
      date: '2026-12-01T10:00:00.000Z',
      agenda: ['Budget', 'Elections'],
    });

    expect(meeting.title).toBe('AGM 2026');
    expect(prisma.agmMeeting.create.mock.calls[0][0].data.agenda).toEqual(['Budget', 'Elections']);
    expect(noopPush.sendToSociety).toHaveBeenCalled();
  });

  it.each([
    ['a blank title', { title: '   ', date: '2026-12-01T10:00:00.000Z' }],
    ['an unparseable date', { title: 'AGM', date: 'not-a-date' }],
  ])('rejects %s', async (_label, dto) => {
    const svc = new AgmService(makePrisma() as any, noopPush);
    await expect(svc.createMeeting('soc-1', dto as any)).rejects.toThrow(BadRequestException);
  });

  it('surfaces votingDeadline and never leaks the raw ballot', async () => {
    const prisma: any = {
      agmMeeting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm1', title: 'AGM', date: new Date(), status: 'UPCOMING',
            resolutions: [
              {
                id: 'r1', title: 'Res 1',
                // `votes` is a residentId -> choice map. Returning it wholesale
                // published every resident's individual vote.
                votes: { __deadline: '2026-12-05T00:00:00.000Z', 'res-1': 'FOR', 'res-2': 'AGAINST', 'res-3': 'FOR' },
              },
            ],
          },
        ]),
      },
    };
    const [meeting]: any = await new AgmService(prisma, noopPush).getMeetings('soc-1');
    const resolution = meeting.resolutions[0];

    expect(resolution.votingDeadline).toBe('2026-12-05T00:00:00.000Z');
    expect(resolution.voteSummary).toEqual({ FOR: 2, AGAINST: 1, ABSTAIN: 0, total: 3 });
    expect(resolution.votes).toBeUndefined();
  });
});

// ── Report 7: "Parking - Log guest parking is not functional"
describe('ParkingService guest parking', () => {
  const makePrisma = (overrides: any = {}) => ({
    guestParkingLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data, entryAt: new Date(), slot: data.slotId ? { id: data.slotId, slotNumber: 'V1' } : null })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    parkingSlot: {
      findFirst: jest.fn().mockResolvedValue({ id: 'slot-1', slotNumber: 'V1', isOccupied: false, societyId: 'soc-1' }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  });

  it('logs a guest for an ADMIN with no resident profile, and occupies a bay', async () => {
    const prisma: any = makePrisma();
    const res = await new ParkingService(prisma).logGuestParking('soc-1', 'admin-user', {
      vehiclePlate: ' ka01ab1234 ',
      visitorName: 'Ravi',
      flatLabel: 'A-402',
    });

    expect(res.vehiclePlate).toBe('KA01AB1234');
    expect(res.slotAssigned).toBe(true);
    expect(prisma.parkingSlot.update).toHaveBeenCalledWith({ where: { id: 'slot-1' }, data: { isOccupied: true } });
  });

  it('refuses to double-park the same plate', async () => {
    const prisma: any = makePrisma();
    prisma.guestParkingLog.findFirst.mockResolvedValue({ id: 'g0' });
    await expect(
      new ParkingService(prisma).logGuestParking('soc-1', 'admin', { vehiclePlate: 'KA01AB1234' }),
    ).rejects.toThrow(ConflictException);
  });

  it('still logs the vehicle when no visitor bay is configured', async () => {
    const prisma: any = makePrisma();
    prisma.parkingSlot.findFirst.mockResolvedValue(null);
    const res = await new ParkingService(prisma).logGuestParking('soc-1', 'admin', { vehiclePlate: 'KA01' });
    expect(res.slotAssigned).toBe(false);
    expect(prisma.parkingSlot.update).not.toHaveBeenCalled();
  });

  it('releases the bay on exit', async () => {
    const prisma: any = makePrisma();
    prisma.guestParkingLog.findFirst.mockResolvedValue({ id: 'g1', slotId: 'slot-1', exitAt: null });
    await new ParkingService(prisma).exitGuestParking('soc-1', 'g1');
    expect(prisma.parkingSlot.update).toHaveBeenCalledWith({ where: { id: 'slot-1' }, data: { isOccupied: false } });
  });

  it('rejects a blank plate', async () => {
    await expect(
      new ParkingService(makePrisma() as any).logGuestParking('soc-1', 'admin', { vehiclePlate: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ── Report 9: "Wallet activity - Issue refund is not functional"
describe('WalletService.refund', () => {
  const makePrisma = (resident: any = { id: 'r1', userId: 'u1' }) => {
    const prisma: any = {
      resident: { findFirst: jest.fn().mockResolvedValue(resident), update: jest.fn().mockResolvedValue({}), findMany: jest.fn() },
      walletTransaction: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'txn-1' }) },
    };
    prisma.$transaction = jest.fn((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
    return prisma;
  };
  const svc = (prisma: any) => new WalletService(prisma, noopPush);

  it('credits the wallet and returns the transaction', async () => {
    const prisma = makePrisma();
    const res = await svc(prisma).refund('r1', { amount: 250, description: 'Goodwill', reference: 'ref-1', societyId: 'soc-1' });
    expect(res).toMatchObject({ success: true, transactionId: 'txn-1', amount: 250 });
  });

  it('refuses to credit a resident in another society', async () => {
    const prisma = makePrisma(null);
    await expect(
      svc(prisma).refund('r1', { amount: 100, description: 'x', reference: 'ref', societyId: 'soc-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    await expect(
      svc(makePrisma()).refund('r1', { amount: 0, description: 'x', reference: 'ref', societyId: 'soc-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('is idempotent on a repeated reference', async () => {
    const prisma = makePrisma();
    prisma.walletTransaction.findFirst.mockResolvedValue({ id: 'existing' });
    const res = await svc(prisma).refund('r1', { amount: 100, description: 'x', reference: 'dup', societyId: 'soc-1' });
    expect(res).toMatchObject({ alreadyProcessed: true, transactionId: 'existing' });
    expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
  });
});

// ── Report 10: "Add vendor - Not functional"
describe('normaliseVendorCategory', () => {
  it.each([
    ['Grocery', VendorCategory.GROCERY],
    ['Restaurant', VendorCategory.RESTAURANT],
    ['Electrician', VendorCategory.ELECTRICIAN],
    ['pharmacy', VendorCategory.PHARMACY],
    ['GROCERY', VendorCategory.GROCERY],
  ])('maps the dashboard label %s', (input, expected) => {
    // The dropdown sent Title Case; @IsEnum wanted UPPER_SNAKE, so every
    // "Add Vendor" submit 400'd.
    expect(normaliseVendorCategory(input)).toBe(expected);
  });

  it('falls back to OTHER rather than refusing to save the vendor', () => {
    expect(normaliseVendorCategory('Astrologer')).toBe(VendorCategory.OTHER);
    expect(normaliseVendorCategory(undefined)).toBe(VendorCategory.OTHER);
  });
});

// ── Resident-app report 2: "Concierge - Request help feature is not functional"
describe('normaliseConciergeType', () => {
  it.each([
    ['Package Pickup', 'COURIER'],
    ['Heavy Lifting', 'OTHER'],
    ['Document Collect', 'FORM_HELP'],
    ['Medicine Pickup', 'PHARMACY'],
    ['cab', 'TAXI'],
  ])('maps the app label %s to the Prisma enum', (input, expected) => {
    // These labels reached Prisma verbatim and threw
    // `Invalid value for argument 'type'` — every request 500'd.
    expect(normaliseConciergeType(input)).toBe(expected);
  });
});

describe('ConciergeService.createRequest', () => {
  it('stores a valid enum and preserves the original label in the description', async () => {
    const prisma: any = {
      resident: { findFirst: jest.fn().mockResolvedValue({ id: 'r1' }) },
      conciergeRequest: { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })) },
    };
    await new ConciergeService(prisma, noopPush).createRequest('u1', 'soc-1', {
      type: 'Heavy Lifting',
      description: 'Move a sofa',
      preferredTime: 'Today evening',
    });

    const data = prisma.conciergeRequest.create.mock.calls[0][0].data;
    expect(data.type).toBe('OTHER');
    expect(data.description).toContain('Move a sofa');
    expect(data.description).toContain('Heavy Lifting');
    expect(data.description).toContain('Today evening');
  });
});

// ── Staff-app report 6: "Request leave - Submit request is not functional"
describe('resolveLeaveFields', () => {
  it('accepts the shape the staff app actually sends', () => {
    // The app posts leaveType/fromDate/toDate; forbidNonWhitelisted rejected
    // all three outright.
    expect(
      resolveLeaveFields({ leaveType: 'CASUAL', fromDate: '2026-09-10', toDate: '2026-09-11', reason: 'Family' } as any),
    ).toEqual({ type: 'CASUAL', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Family' });
  });

  it('still accepts the canonical shape', () => {
    expect(
      resolveLeaveFields({ type: 'MEDICAL', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Fever' } as any),
    ).toEqual({ type: 'MEDICAL', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Fever' });
  });

  it('names the missing field instead of failing opaquely', () => {
    expect(() => resolveLeaveFields({ reason: 'x' } as any)).toThrow(/type, startDate, endDate/);
  });
});

// ── Report 12: "Infrastructure - Report feature is not functional"
describe('InfrastructureService', () => {
  const makePrisma = (item: any = { id: 'i1', status: 'OPERATIONAL', incidents: [] }) => ({
    infrastructureItem: { findUnique: jest.fn().mockResolvedValue(item), update: jest.fn().mockResolvedValue({}) },
    infraIncident: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inc1', ...data })),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inc1', ...data })),
      count: jest.fn().mockResolvedValue(0),
    },
  });

  it('persists the title and severity the form has always collected', async () => {
    const prisma: any = makePrisma();
    await new InfrastructureService(prisma).reportIncident('u1', {
      itemId: 'i1',
      title: '  Lift stuck  ',
      description: 'Between floors 3 and 4',
      severity: 'CRITICAL' as any,
    });
    const data = prisma.infraIncident.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ title: 'Lift stuck', severity: 'CRITICAL' });
  });

  it('flips the asset to FAULT on a critical report', async () => {
    const prisma: any = makePrisma();
    await new InfrastructureService(prisma).reportIncident('u1', { itemId: 'i1', description: 'Dead', severity: 'HIGH' as any });
    expect(prisma.infrastructureItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAULT' }) }),
    );
  });

  it('defaults severity to MEDIUM and leaves an operational asset alone', async () => {
    const prisma: any = makePrisma();
    await new InfrastructureService(prisma).reportIncident('u1', { itemId: 'i1', description: 'Squeaky' });
    expect(prisma.infraIncident.create.mock.calls[0][0].data.severity).toBe('MEDIUM');
    expect(prisma.infrastructureItem.update).not.toHaveBeenCalled();
  });

  it('resolves with an empty body and restores the asset', async () => {
    const prisma: any = makePrisma();
    prisma.infraIncident.findUnique.mockResolvedValue({ id: 'inc1', itemId: 'i1', resolvedAt: null });
    // The Resolve button PATCHes {} — requiring a note made every click 400.
    const resolved: any = await new InfrastructureService(prisma).resolveIncident('inc1', {}, 'u9');
    expect(resolved.resolution).toBe('Resolved by admin');
    expect(prisma.infrastructureItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OPERATIONAL' }) }),
    );
  });
});

// ── Report 15: "Society Budget - Incomplete information"
describe('SocietyService budget', () => {
  const makePrisma = () => ({
    societyBudget: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'b1', ...data, publishedAt: new Date(), createdAt: new Date() }),
      ),
      update: jest.fn(),
    },
  });

  it('accepts the totalBudget/breakdown shape the dashboard sends', async () => {
    const prisma: any = makePrisma();
    const budget: any = await new SocietyService(prisma).createBudget('soc-1', {
      year: 2026,
      totalBudget: 1_000_000,
      breakdown: [
        { name: 'Security', allocated: 400_000, spent: 120_000 },
        { name: 'Housekeeping', allocated: 300_000 },
      ],
    } as any);

    expect(budget.totalBudget).toBe(1_000_000);
    expect(budget.totalAllocated).toBe(700_000);
    expect(budget.totalSpent).toBe(120_000);
    expect(budget.unallocated).toBe(300_000);
    expect(budget.breakdown[0]).toMatchObject({ name: 'Security', remaining: 280_000, utilisationPct: 30 });
    // Annual budgets use month 0 so the (societyId, year, month) unique key holds.
    expect(prisma.societyBudget.create.mock.calls[0][0].data.month).toBe(0);
  });

  it('returns the budget itself, not a { budget } wrapper', async () => {
    const prisma: any = makePrisma();
    prisma.societyBudget.findFirst.mockResolvedValue({
      id: 'b1', year: 2026, month: 0, totalIncome: 500, lineItems: [], publishedAt: new Date(), createdAt: new Date(),
    });
    const budget: any = await new SocietyService(prisma).getBudget('soc-1', 2026);
    expect(budget.id).toBe('b1');
    expect(budget.totalBudget).toBe(500);
    expect((budget as any).budget).toBeUndefined();
  });

  it('returns null when nothing is published for the year', async () => {
    expect(await new SocietyService(makePrisma() as any).getBudget('soc-1', 2026)).toBeNull();
  });

  it('refuses to allocate more than the total budget', async () => {
    await expect(
      new SocietyService(makePrisma() as any).createBudget('soc-1', {
        year: 2026, totalBudget: 100, breakdown: [{ name: 'A', allocated: 150 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a total', async () => {
    await expect(
      new SocietyService(makePrisma() as any).createBudget('soc-1', { year: 2026 } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
