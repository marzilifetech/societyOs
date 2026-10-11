import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DomesticAttendanceStatus } from '@prisma/client';
import { DomesticHelpService } from './domestic-help.service';
import { CreateDomesticHelpDto, MarkAttendanceDto } from './dto/domestic-help.dto';

/** Validate the way the global pipe does (transform, whitelist, forbid unknown). */
async function errorsFor<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors: errors.map((e) => e.property) };
}

describe('domestic help request formats the shipped app sends', () => {
  it('accepts a helper with a role label and gate access', async () => {
    const { dto, errors } = await errorsFor(CreateDomesticHelpDto, {
      name: 'Sunita',
      role: 'Cook',
      phone: '9876543210',
      gateAccess: true,
    });
    expect(errors).toEqual([]);
    expect(dto.role).toBe('COOK');
  });

  it('files "Security" under OTHER', async () => {
    const { dto, errors } = await errorsFor(CreateDomesticHelpDto, { name: 'Raju', role: 'Security', phone: '1' });
    expect(errors).toEqual([]);
    expect(dto.role).toBe('OTHER');
  });

  it('accepts attendance as { present, date }', async () => {
    const { errors } = await errorsFor(MarkAttendanceDto, { present: true, date: '2026-10-11' });
    expect(errors).toEqual([]);
  });
});

describe('DomesticHelpService', () => {
  const resident = { id: 'r1', userId: 'u1', flat: {}, user: {} };
  const prisma: any = {
    resident: { findUnique: jest.fn().mockResolvedValue(resident) },
    domesticHelp: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    domesticAttendance: { upsert: jest.fn(), deleteMany: jest.fn() },
    domesticHelpPayment: { create: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const service = new DomesticHelpService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('marks present=true as PRESENT for that calendar day', async () => {
    prisma.domesticHelp.findUnique.mockResolvedValue({ id: 'h1', residentId: 'r1' });
    await service.markAttendance('h1', 'u1', { present: true, date: '2026-10-11T03:00:00.000Z' } as any);
    expect(prisma.domesticAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1_2026-10-11' },
        create: expect.objectContaining({ status: DomesticAttendanceStatus.PRESENT }),
      }),
    );
  });

  it('returns the calendar map and last payment the detail screen reads', async () => {
    prisma.domesticHelp.findUnique.mockResolvedValue({
      id: 'h1',
      residentId: 'r1',
      attendance: [{ date: new Date('2026-10-10T00:00:00.000Z'), status: DomesticAttendanceStatus.ABSENT }],
      payments: [{ amount: '4500.00', paidAt: new Date('2026-10-01T00:00:00.000Z') }],
    });
    const out: any = await service.findOne('h1', 'u1');
    expect(out.monthlyAttendance).toEqual({ '2026-10-10': 'absent' });
    expect(out.lastPayment).toEqual({ amount: 4500, date: new Date('2026-10-01T00:00:00.000Z') });
    expect(out).not.toHaveProperty('payments');
  });

  it('stores a salary payment', async () => {
    prisma.domesticHelp.findUnique.mockResolvedValue({ id: 'h1', residentId: 'r1', salary: null });
    prisma.domesticHelpPayment.create.mockResolvedValue({ amount: '3000', paidAt: new Date('2026-10-11T00:00:00.000Z') });
    const out = await service.logSalaryPayment('h1', 'u1', { amount: 3000 });
    expect(prisma.domesticHelpPayment.create).toHaveBeenCalledWith({ data: { domesticHelpId: 'h1', amount: 3000 } });
    expect(out.lastPayment.amount).toBe(3000);
  });

  it('removes attendance and payments with the helper', async () => {
    prisma.domesticHelp.findUnique.mockResolvedValue({ id: 'h1', residentId: 'r1' });
    await service.remove('h1', 'u1');
    expect(prisma.domesticAttendance.deleteMany).toHaveBeenCalledWith({ where: { domesticHelpId: 'h1' } });
    expect(prisma.domesticHelp.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it("won't touch another resident's helper", async () => {
    prisma.domesticHelp.findUnique.mockResolvedValue({ id: 'h1', residentId: 'someone-else' });
    await expect(service.logSalaryPayment('h1', 'u1', { amount: 1 })).rejects.toThrow('Domestic help not found');
  });
});
