import { NotFoundException } from '@nestjs/common';
import { StaffService } from './staff.service';

/** An instant given as IST wall-clock time. */
const ist = (s: string) => new Date(`${s}+05:30`);

function setup(society: { config?: unknown } = {}, shiftTemplateId: string | null = null) {
  const prisma: any = {
    staffMember: {
      findUnique: jest.fn().mockResolvedValue({ id: 'sm1', userId: 'u1', shiftTemplateId, society }),
    },
    staffAttendance: {
      upsert: jest.fn(async (a) => a.create),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(async (a) => a.data),
    },
    leaveRequest: { count: jest.fn().mockResolvedValue(0) },
  };
  const svc = new StaffService(prisma, {} as any, { emit: jest.fn() } as any, {} as any);
  return { prisma, svc };
}

afterEach(() => jest.useRealTimers());

describe('checkIn', () => {
  it('books a 01:00 IST check-in on the IST day and judges lateness by the assigned night shift', async () => {
    jest.useFakeTimers({ now: ist('2026-10-11T01:00:00') });
    const config = { shiftTemplates: [{ id: 'n', startTime: '22:00', endTime: '06:00' }] };
    const { prisma, svc } = setup({ config }, 'n');

    await svc.checkIn('u1', 12.9, 77.6);

    const args = prisma.staffAttendance.upsert.mock.calls[0][0];
    expect(args.where.staffId_date.date.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(args.create.isLate).toBe(true);
  });

  it('is on time at 09:05 IST for the default shift (it used to be judged in UTC)', async () => {
    jest.useFakeTimers({ now: ist('2026-10-11T09:05:00') });
    const { prisma, svc } = setup();
    await svc.checkIn('u1', 12.9, 77.6);
    expect(prisma.staffAttendance.upsert.mock.calls[0][0].create.isLate).toBe(false);
  });

  it('requires a location when the society has a geofence', async () => {
    const { svc } = setup({ config: { geofence: { center: { lat: 12.9, lng: 77.6 }, radius: 200 } } });
    await expect(svc.checkIn('u1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LOCATION_REQUIRED' }),
    });
  });

  it('refuses a check-in outside the geofence', async () => {
    const { svc } = setup({ config: { geofence: { center: { lat: 12.9, lng: 77.6 }, radius: 200 } } });
    await expect(svc.checkIn('u1', 13.5, 77.6)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OUTSIDE_GEOFENCE' }),
    });
  });
});

describe('checkOut', () => {
  it("closes a night shift the next morning (looking up today's row used to 404)", async () => {
    jest.useFakeTimers({ now: ist('2026-10-11T06:10:00') });
    const config = { shiftTemplates: [{ id: 'n', startTime: '22:00', endTime: '06:00' }] };
    const { prisma, svc } = setup({ config }, 'n');
    prisma.staffAttendance.findFirst.mockResolvedValue({ id: 'att-yesterday' });

    const out = await svc.checkOut('u1');

    const where = prisma.staffAttendance.findFirst.mock.calls[0][0].where;
    expect(where.date.gte.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(where.checkOut).toBeNull();
    expect(prisma.staffAttendance.update.mock.calls[0][0].where).toEqual({ id: 'att-yesterday' });
    expect(out.isEarlyDeparture).toBe(false);
  });

  it('flags leaving before the shift ends', async () => {
    jest.useFakeTimers({ now: ist('2026-10-11T16:00:00') });
    const { prisma, svc } = setup();
    prisma.staffAttendance.findFirst.mockResolvedValue({ id: 'att' });
    expect((await svc.checkOut('u1')).isEarlyDeparture).toBe(true);
  });

  it('says so when there is nothing to check out of', async () => {
    const { prisma, svc } = setup();
    prisma.staffAttendance.findFirst.mockResolvedValue(null);
    await expect(svc.checkOut('u1')).rejects.toThrow(NotFoundException);
  });
});

describe('getSummary', () => {
  it('reports checked-in status for Home', async () => {
    jest.useFakeTimers({ now: ist('2026-10-11T10:00:00') });
    const { prisma, svc } = setup();
    prisma.staffAttendance.count = jest.fn().mockResolvedValue(3);
    const checkIn = ist('2026-10-11T08:55:00');
    prisma.staffAttendance.findUnique.mockResolvedValue({ checkIn, checkOut: null });
    await expect(svc.getSummary('u1')).resolves.toEqual(
      expect.objectContaining({ checkedIn: true, checkInTime: checkIn, attendanceCount: 3 }),
    );
  });
});
