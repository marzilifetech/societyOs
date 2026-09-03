/**
 * Regression tests for the 2026-09 dashboard defect sweep.
 *
 * Each block pins the exact behaviour a reported defect was missing, so the
 * bug cannot silently return. Grouped by the report they close.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AuditService } from '../../common/audit/audit.service';
import { SocietySeederService } from '../society/society-seeder.service';
import { MarziMediaSigner } from '../../common/storage/marzi-media-signer.service';

const prisma: Record<string, any> = {
  resident: { findMany: jest.fn() },
  staffMember: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  staffAttendance: { findMany: jest.fn() },
  leaveRequest: { findMany: jest.fn() },
  user: { update: jest.fn() },
  event: { findMany: jest.fn() },
  flat: { findMany: jest.fn() },
  travelPause: { findMany: jest.fn() },
  maintenanceBill: { findMany: jest.fn(), findUnique: jest.fn(), createMany: jest.fn() },
  society: { findUnique: jest.fn(), update: jest.fn() },
};
prisma.$transaction = jest.fn((arg: unknown) => {
  if (typeof arg === 'function') return (arg as (tx: typeof prisma) => unknown)(prisma);
  if (Array.isArray(arg)) return Promise.all(arg);
  return arg;
});

const push = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};

describe('AdminService — dashboard defect sweep', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: { notifyUser: jest.fn(), sendToToken: jest.fn() } },
        { provide: PushService, useValue: push },
        { provide: ComplianceService, useValue: { dataExport: jest.fn() } },
        { provide: AuditService, useValue: { write: jest.fn().mockResolvedValue(undefined) } },
        { provide: SocietySeederService, useValue: { buildDefaultConfig: jest.fn(() => ({})) } },
        { provide: MarziMediaSigner, useValue: { signGet: jest.fn(), signGetMany: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  // ── Report 2: "After a resident entry is rejected, entry should not be seen
  //    in the resident list" ────────────────────────────────────────────────
  describe('getResidents', () => {
    beforeEach(() => prisma.resident.findMany.mockResolvedValue([]));

    it('excludes REJECTED registrations by default', async () => {
      await service.getResidents('soc-1');
      const where = prisma.resident.findMany.mock.calls[0][0].where;
      expect(where.user.status).toEqual({ not: 'REJECTED' });
    });

    it('returns only rejected rows when explicitly asked, so nothing is destroyed', async () => {
      await service.getResidents('soc-1', undefined, 'REJECTED');
      const where = prisma.resident.findMany.mock.calls[0][0].where;
      expect(where.user.status).toBe('REJECTED');
    });
  });

  // ── Report 1: "Staff deactivation is shown as completed but it isn't
  //    processed" — the list never carried account status ──────────────────
  describe('getStaff', () => {
    it('returns the account status so the row can render Inactive', async () => {
      prisma.staffMember.findMany.mockResolvedValue([
        {
          id: 'sm-1', designation: 'Guard', department: null, categories: [],
          joiningDate: null, leavingDate: null, createdAt: new Date(),
          user: { name: 'A', phone: '+91', status: 'INACTIVE' },
        },
        {
          id: 'sm-2', designation: 'Guard', department: null, categories: [],
          joiningDate: null, leavingDate: null, createdAt: new Date(),
          user: { name: 'B', phone: '+92', status: 'ACTIVE' },
        },
      ]);
      const rows = await service.getStaff('soc-1');
      expect(rows[0]).toMatchObject({ status: 'INACTIVE', isActive: false });
      expect(rows[1]).toMatchObject({ status: 'ACTIVE', isActive: true });
    });
  });

  // ── Report 3: "When a created event is cancelled, it is still displayed
  //    under upcoming events" ────────────────────────────────────────────────
  describe('getAdminEvents', () => {
    it('never marks a cancelled future event as upcoming', async () => {
      const future = new Date(Date.now() + 7 * 86_400_000);
      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', title: 'Live', description: '', category: null, date: future, venue: 'Hall', capacity: null, status: 'PUBLISHED', createdAt: new Date(), _count: { registrations: 0 } },
        { id: 'e2', title: 'Called off', description: '', category: null, date: future, venue: 'Hall', capacity: null, status: 'CANCELLED', createdAt: new Date(), _count: { registrations: 3 } },
        { id: 'e3', title: 'Draft', description: '', category: null, date: future, venue: 'Hall', capacity: null, status: 'DRAFT', createdAt: new Date(), _count: { registrations: 0 } },
      ]);
      const rows = await service.getAdminEvents('soc-1');
      expect(rows.find((r) => r.id === 'e1')!.isUpcoming).toBe(true);
      expect(rows.find((r) => r.id === 'e2')!.isUpcoming).toBe(false);
      expect(rows.find((r) => r.id === 'e2')!.isCancelled).toBe(true);
      // DRAFT is not published, so it is not "upcoming" either.
      expect(rows.find((r) => r.id === 'e3')!.isUpcoming).toBe(false);
    });
  });

  // ── Report 4: "Reports section can't be viewed" — the page crashed on
  //    `undefined.toLocaleString()` because the shapes did not match ────────
  describe('getMaintenanceReport', () => {
    it('returns `outstanding` and {count, amount} aging buckets', async () => {
      const now = Date.now();
      prisma.maintenanceBill.findMany.mockResolvedValue([
        { total: 1000, period: '2026-01', status: 'SUCCESS', dueDate: new Date(now - 5 * 86_400_000), payments: [] },
        { total: 500, period: '2026-02', status: 'PENDING', dueDate: new Date(now - 10 * 86_400_000), payments: [] },
        { total: 700, period: '2026-03', status: 'PENDING', dueDate: new Date(now - 100 * 86_400_000), payments: [] },
      ]);

      const report = await service.getMaintenanceReport('soc-1', 2026);

      // The exact key the Reports page reads.
      expect(report.summary.outstanding).toBe(1200);
      expect(report.summary.totalOutstanding).toBe(1200);
      // Buckets must be objects, not bare numbers.
      expect(report.agingBuckets.current).toEqual({ count: 1, amount: 500 });
      expect(report.agingBuckets.overdue90).toEqual({ count: 1, amount: 700 });
      for (const bucket of Object.values(report.agingBuckets)) {
        expect(typeof bucket.count).toBe('number');
        expect(typeof bucket.amount).toBe('number');
      }
    });
  });

  // ── Report 4c: bill generation produced zero-rupee bills, one per RESIDENT
  //    rather than one per FLAT, with no way to review before committing ────
  describe('bill generation', () => {
    const societyRow = (maintenance: unknown) => ({ id: 'soc-1', config: { maintenance } });

    beforeEach(() => {
      prisma.travelPause.findMany.mockResolvedValue([]);
      prisma.maintenanceBill.findMany.mockResolvedValue([]);
      prisma.maintenanceBill.createMany.mockResolvedValue({ count: 0 });
    });

    it('charges the configured flat rate instead of zero', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'FLAT', flatRate: 2500, dueDay: 10 }));
      prisma.flat.findMany.mockResolvedValue([
        {
          id: 'f1', block: 'A', number: '101', areaSqft: 900,
          residents: [{ id: 'r1', userId: 'u1', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'Owner' } }],
        },
      ]);

      const preview = await service.previewBills('soc-1', 2026, 9);

      expect(preview.billCount).toBe(1);
      expect(preview.totalAmount).toBe(2500);
      expect(preview.lines[0]).toMatchObject({ flat: 'A-101', total: 2500 });
      expect(preview.warnings).toHaveLength(0);
    });

    it('bills a flat ONCE even when several residents live in it', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'FLAT', flatRate: 1000 }));
      prisma.flat.findMany.mockResolvedValue([
        {
          id: 'f1', block: 'A', number: '101', areaSqft: null,
          residents: [
            { id: 'r1', userId: 'u1', type: 'TENANT', moveInDate: new Date('2025-01-01'), createdAt: new Date(), user: { name: 'T1' } },
            { id: 'r2', userId: 'u2', type: 'OWNER', moveInDate: new Date('2024-01-01'), createdAt: new Date(), user: { name: 'Owner' } },
            { id: 'r3', userId: 'u3', type: 'TENANT', moveInDate: new Date('2025-06-01'), createdAt: new Date(), user: { name: 'T2' } },
          ],
        },
      ]);

      const preview = await service.previewBills('soc-1', 2026, 9);

      expect(preview.billCount).toBe(1);
      // Billed to the OWNER, not whoever happened to be first in the array.
      expect(preview.lines[0].residentId).toBe('r2');
    });

    it('computes per-sqft charges and warns when a rate is missing', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'PER_SQFT', ratePerSqft: 3 }));
      prisma.flat.findMany.mockResolvedValue([
        { id: 'f1', block: 'A', number: '101', areaSqft: 1200, residents: [{ id: 'r1', userId: 'u1', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O' } }] },
        { id: 'f2', block: 'A', number: '102', areaSqft: null, residents: [{ id: 'r2', userId: 'u2', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O2' } }] },
      ]);

      const preview = await service.previewBills('soc-1', 2026, 9);

      expect(preview.lines).toHaveLength(1);
      expect(preview.lines[0].total).toBe(3600);
      expect(preview.skipped).toEqual([{ flatId: 'f2', flat: 'A-102', reason: 'missing_area' }]);
      expect(preview.warnings.join(' ')).toMatch(/no area on record/i);
    });

    it('warns loudly rather than silently generating a month of zero-rupee bills', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({}));
      prisma.flat.findMany.mockResolvedValue([
        { id: 'f1', block: 'A', number: '101', areaSqft: 900, residents: [{ id: 'r1', userId: 'u1', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O' } }] },
      ]);

      const preview = await service.previewBills('soc-1', 2026, 9);

      expect(preview.totalAmount).toBe(0);
      expect(preview.warnings.join(' ')).toMatch(/No flat maintenance rate is configured/i);
    });

    it('skips flats already billed for the period so re-running is safe', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'FLAT', flatRate: 1000 }));
      prisma.flat.findMany.mockResolvedValue([
        { id: 'f1', block: 'A', number: '101', areaSqft: null, residents: [{ id: 'r1', userId: 'u1', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O' } }] },
      ]);
      prisma.maintenanceBill.findMany.mockResolvedValue([{ flatId: 'f1' }]);

      const preview = await service.previewBills('soc-1', 2026, 9);

      expect(preview.billCount).toBe(0);
      expect(preview.skipped[0]).toMatchObject({ reason: 'already_billed' });
    });

    it('rejects an out-of-range month instead of writing a bad period', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'FLAT', flatRate: 100 }));
      await expect(service.previewBills('soc-1', 2026, 13)).rejects.toThrow(BadRequestException);
      await expect(service.generateBills('soc-1', 2026, 0)).rejects.toThrow(BadRequestException);
    });

    it('preview and generate agree on the exact amounts written', async () => {
      prisma.society.findUnique.mockResolvedValue(societyRow({ mode: 'FLAT', flatRate: 1500, dueDay: 15 }));
      prisma.flat.findMany.mockResolvedValue([
        { id: 'f1', block: 'A', number: '101', areaSqft: null, residents: [{ id: 'r1', userId: 'u1', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O' } }] },
        { id: 'f2', block: 'A', number: '102', areaSqft: null, residents: [{ id: 'r2', userId: 'u2', type: 'OWNER', moveInDate: null, createdAt: new Date(), user: { name: 'O2' } }] },
      ]);

      const preview = await service.previewBills('soc-1', 2026, 9);
      const result = await service.generateBills('soc-1', 2026, 9);

      expect(result.created).toBe(preview.billCount);
      expect(result.totalAmount).toBe(preview.totalAmount);
      const written = prisma.maintenanceBill.createMany.mock.calls[0][0].data;
      expect(written.map((b: any) => b.total)).toEqual([1500, 1500]);
      // One row per flat — never one per resident.
      expect(new Set(written.map((b: any) => b.flatId)).size).toBe(written.length);
    });
  });

  // ── Report 4a: "Send reminder error — No FCM file or token" ──────────────
  describe('sendPaymentReminder', () => {
    const bill = {
      id: 'b1', total: 2500, period: '2026-09', dueDate: new Date('2026-09-10'), status: 'PENDING',
      flat: { societyId: 'soc-1' },
      resident: { user: { id: 'u1' } },
    };

    it('reports success when the reminder lands in the in-app inbox without a push token', async () => {
      prisma.maintenanceBill.findUnique.mockResolvedValue(bill);
      push.send.mockResolvedValueOnce({ ok: false, reason: 'no_token', deliveredInApp: true });

      const res = await service.sendPaymentReminder('b1', 'soc-1');

      expect(res.sent).toBe(true);
      expect(res.channel).toBe('in_app');
      expect(res.note).toMatch(/in-app inbox/i);
    });

    it('still reports failure when nothing was delivered at all', async () => {
      prisma.maintenanceBill.findUnique.mockResolvedValue(bill);
      push.send.mockResolvedValueOnce({ ok: false, reason: 'opted_out' });

      const res = await service.sendPaymentReminder('b1', 'soc-1');

      expect(res.sent).toBe(false);
      expect(res.channel).toBe('none');
    });
  });

  // ── Staff-app report 5: "After checking in, it is not updated in the
  //    dashboard" — nothing read StaffAttendance society-wide ──────────────
  describe('getStaffAttendanceToday', () => {
    it('classifies on-duty, checked-out, on-leave and absent staff', async () => {
      const day = new Date('2026-09-03T00:00:00.000Z');
      prisma.staffMember.findMany.mockResolvedValue([
        { id: 'sm-1', designation: 'Guard', department: null, user: { name: 'On duty', phone: '1', status: 'ACTIVE' } },
        { id: 'sm-2', designation: 'Cleaner', department: null, user: { name: 'Done', phone: '2', status: 'ACTIVE' } },
        { id: 'sm-3', designation: 'Gardener', department: null, user: { name: 'On leave', phone: '3', status: 'ACTIVE' } },
        { id: 'sm-4', designation: 'Plumber', department: null, user: { name: 'Absent', phone: '4', status: 'ACTIVE' } },
      ]);
      prisma.staffAttendance.findMany.mockResolvedValue([
        { staffId: 'sm-1', date: day, checkIn: new Date('2026-09-03T03:30:00.000Z'), checkOut: null, isLate: true, lateReason: 'Traffic' },
        { staffId: 'sm-2', date: day, checkIn: new Date('2026-09-03T03:30:00.000Z'), checkOut: new Date('2026-09-03T11:30:00.000Z'), isLate: false, lateReason: null },
      ]);
      prisma.leaveRequest.findMany.mockResolvedValue([{ staffId: 'sm-3', type: 'CASUAL' }]);

      const res = await service.getStaffAttendanceToday('soc-1', '2026-09-03');

      expect(res.summary).toMatchObject({
        totalStaff: 4, onDuty: 1, checkedOut: 1, onLeave: 1, absent: 1, late: 1, present: 2,
      });
      expect(res.staff.find((s) => s.staffId === 'sm-1')!.state).toBe('ON_DUTY');
      expect(res.staff.find((s) => s.staffId === 'sm-2')!.state).toBe('CHECKED_OUT');
      expect(res.staff.find((s) => s.staffId === 'sm-2')!.hoursWorked).toBe(8);
      expect(res.staff.find((s) => s.staffId === 'sm-3')!.state).toBe('ON_LEAVE');
      expect(res.staff.find((s) => s.staffId === 'sm-4')!.state).toBe('ABSENT');
    });
  });

  // ── Report 4c (config): rate card round-trip ────────────────────────────
  describe('maintenance rate config', () => {
    it('defaults to a FLAT zero rate and persists an update', async () => {
      prisma.society.findUnique.mockResolvedValue({ id: 'soc-1', config: {} });
      expect(await service.getMaintenanceRateConfig('soc-1')).toMatchObject({ mode: 'FLAT', flatRate: 0, dueDay: 28 });

      prisma.society.update.mockResolvedValue({});
      const next = await service.updateMaintenanceRateConfig('soc-1', { mode: 'PER_SQFT', ratePerSqft: 4.5, dueDay: 40 });

      expect(next.mode).toBe('PER_SQFT');
      expect(next.ratePerSqft).toBe(4.5);
      // dueDay is clamped to a day that exists in February.
      expect(next.dueDay).toBe(28);
    });

    it('refuses a negative rate', async () => {
      prisma.society.findUnique.mockResolvedValue({ id: 'soc-1', config: {} });
      await expect(service.updateMaintenanceRateConfig('soc-1', { flatRate: -5 })).rejects.toThrow(BadRequestException);
    });
  });
});
