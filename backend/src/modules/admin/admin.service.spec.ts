import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ComplaintStatus, LeaveStatus, UserRole, InfrastructureType, InfrastructureStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AuditService } from '../../common/audit/audit.service';
import { SocietySeederService } from '../society/society-seeder.service';
import { MarziMediaSigner } from '../../common/storage/marzi-media-signer.service';

const mockPrisma: Record<string, any> = {
  complaint: { findUnique: jest.fn(), update: jest.fn() },
  leaveRequest: { findUnique: jest.fn(), update: jest.fn() },
  visitor: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  resident: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn(), delete: jest.fn() },
  flat: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  society: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
  staffMember: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn() },
  staffDocument: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn() },
  staffLoan: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  maintenanceBill: { findUnique: jest.fn(), update: jest.fn() },
  domesticHelp: { findMany: jest.fn() },
  pestControlSchedule: { findMany: jest.fn() },
  infrastructureItem: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
};
const mockPush = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};
mockPrisma.$transaction = jest.fn((arg: unknown) => {
  if (typeof arg === 'function') return (arg as (tx: typeof mockPrisma) => unknown)(mockPrisma);
  if (Array.isArray(arg)) return Promise.all(arg);
  return arg;
});

describe('AdminService', () => {
  let service: AdminService;
  // Captured audit-write spy so lifecycle tests can assert the audit trail.
  const auditWriteSpy = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: { sendToToken: jest.fn() } },
        { provide: PushService, useValue: mockPush },
        { provide: ComplianceService, useValue: { dataExport: jest.fn() } },
        { provide: AuditService, useValue: { write: auditWriteSpy } },
        { provide: SocietySeederService, useValue: { buildDefaultConfig: jest.fn(() => ({})) } },
        {
          provide: MarziMediaSigner,
          useValue: { sign: jest.fn().mockResolvedValue(null), signMany: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
    auditWriteSpy.mockClear();
  });

  describe('updateComplaintStatus', () => {
    it('rejects illegal status transitions with INVALID_COMPLAINT_TRANSITION', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue({
        id: 'c1',
        societyId: 'soc-a',
        status: ComplaintStatus.OPEN,
      });

      await expect(
        service.updateComplaintStatus('c1', 'soc-a', ComplaintStatus.RESOLVED),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INVALID_COMPLAINT_TRANSITION',
          from: ComplaintStatus.OPEN,
          to: ComplaintStatus.RESOLVED,
        }),
      });
      expect(mockPrisma.complaint.update).not.toHaveBeenCalled();
    });
  });

  describe('approveLeave', () => {
    it('conflicts when leave already approved', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv1',
        status: LeaveStatus.APPROVED,
        staff: { societyId: 'soc-a' },
      });

      await expect(service.approveLeave('lv1', 'soc-a')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LEAVE_ALREADY_DECIDED',
          currentStatus: LeaveStatus.APPROVED,
        }),
      });
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });
  });

  // ─── approveVisitor ────────────────────────────────────────────────────────

  describe('approveVisitor', () => {
    it('throws NotFoundException when visitor does not exist', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue(null);

      await expect(service.approveVisitor('v-missing', 'soc-1', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.visitor.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException (VISITOR_SOCIETY_MISMATCH) when society does not match', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue({
        id: 'v1',
        resident: { flat: { societyId: 'soc-other' } },
      });

      await expect(service.approveVisitor('v1', 'soc-1', 'admin-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VISITOR_SOCIETY_MISMATCH' }),
      });
      expect(mockPrisma.visitor.update).not.toHaveBeenCalled();
    });

    it('sets approvalStatus=APPROVED on happy path', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue({
        id: 'v1',
        resident: { flat: { societyId: 'soc-1' } },
      });
      mockPrisma.visitor.update.mockResolvedValue({ id: 'v1', approvalStatus: 'APPROVED' });

      const result = await service.approveVisitor('v1', 'soc-1', 'admin-1');

      expect(result).toEqual(expect.objectContaining({ approvalStatus: 'APPROVED' }));
      expect(mockPrisma.visitor.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({
          approvalStatus: 'APPROVED',
          approvedById: 'admin-1',
          approvedAt: expect.any(Date),
        }),
      });
    });
  });

  // ─── rejectVisitor ─────────────────────────────────────────────────────────

  describe('rejectVisitor', () => {
    it('throws NotFoundException when visitor does not exist', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue(null);

      await expect(service.rejectVisitor('v-missing', 'soc-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.visitor.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when society does not match', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue({
        id: 'v1',
        resident: { flat: { societyId: 'soc-other' } },
      });

      await expect(service.rejectVisitor('v1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VISITOR_SOCIETY_MISMATCH' }),
      });
    });

    it('sets approvalStatus=REJECTED on happy path', async () => {
      mockPrisma.visitor.findUnique.mockResolvedValue({
        id: 'v1',
        resident: { flat: { societyId: 'soc-1' } },
      });
      mockPrisma.visitor.update.mockResolvedValue({ id: 'v1', approvalStatus: 'REJECTED' });

      const result = await service.rejectVisitor('v1', 'soc-1');

      expect(result).toEqual(expect.objectContaining({ approvalStatus: 'REJECTED' }));
      expect(mockPrisma.visitor.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { approvalStatus: 'REJECTED' },
      });
    });
  });

  // ─── getStaffLoans ─────────────────────────────────────────────────────────

  describe('getStaffLoans', () => {
    it('throws NotFoundException when staff not found in caller society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(service.getStaffLoans('soc-1', 'staff-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffLoan.findMany).not.toHaveBeenCalled();
    });

    it('returns loans for the staff member when society matches', async () => {
      const loans = [{ id: 'loan-1', staffMemberId: 'sm-1', amount: 5000 }];
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffLoan.findMany.mockResolvedValue(loans);

      const result = await service.getStaffLoans('soc-1', 'sm-1');

      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
      expect(result).toEqual(loans);
    });
  });

  // ─── getStaffSalarySlips ───────────────────────────────────────────────────
  // Locks in the ownership check added 2026-05 to prevent a SUPER_ADMIN
  // with X-Society-Id switch (or any admin) from reading salary slips for
  // a staff member in another society. SalarySlip is not in
  // DIRECT_TENANT_SCOPED, so the Prisma extension can't auto-scope the
  // findMany; the service guards via a composite (id, societyId) lookup
  // on StaffMember first.

  describe('getStaffSalarySlips — cross-tenant guard', () => {
    it('throws NotFoundException when staff belongs to another society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(
        service.getStaffSalarySlips('soc-A', 'staff-from-soc-B'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.salarySlip = mockPrisma.salarySlip ?? {}).toBeTruthy();
    });

    it('returns slips when staff belongs to caller society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.salarySlip = {
        findMany: jest.fn().mockResolvedValue([{ id: 'slip-1', staffId: 'sm-1' }]),
      };

      const result = await service.getStaffSalarySlips('soc-A', 'sm-1');

      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-A' },
        select: { id: true },
      });
      expect(result).toEqual([{ id: 'slip-1', staffId: 'sm-1' }]);
    });
  });

  // ─── createStaffLoan ───────────────────────────────────────────────────────

  describe('createStaffLoan', () => {
    it('throws NotFoundException when staff not found in caller society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(service.createStaffLoan('soc-1', 'staff-missing', 1000)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffLoan.create).not.toHaveBeenCalled();
    });

    it('creates a loan record with default PENDING status when society matches', async () => {
      const created = { id: 'loan-1', staffMemberId: 'sm-1', amount: 2000, status: 'PENDING' };
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffLoan.create.mockResolvedValue(created);

      const result = await service.createStaffLoan('soc-1', 'sm-1', 2000, 'emergency');

      expect(result).toEqual(created);
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
    });

    it('creates a loan with explicit status when provided', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffLoan.create.mockResolvedValue({ id: 'loan-2', status: 'APPROVED' });

      await service.createStaffLoan('soc-1', 'sm-1', 3000, undefined, 'APPROVED');

      expect(mockPrisma.staffLoan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'APPROVED' }),
      });
    });
  });

  // ─── updateBillStatus ──────────────────────────────────────────────────────

  describe('updateBillStatus', () => {
    // H4: signature now requires an actor (id, role) so the service can
    // gate SUCCESS→PENDING reversals to SUPER_ADMIN + audit each change.
    const actor = { id: 'ad-1', role: 'ADMIN' };

    it('throws BadRequestException for invalid status', async () => {
      await expect(service.updateBillStatus('bill-1', 'soc-1', 'INVALID', actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.maintenanceBill.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when bill not found', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue(null);

      await expect(service.updateBillStatus('bill-missing', 'soc-1', 'SUCCESS', actor)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.maintenanceBill.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when bill belongs to another society', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'PENDING',
        flat: { societyId: 'soc-other' },
      });

      await expect(service.updateBillStatus('bill-1', 'soc-1', 'SUCCESS', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.maintenanceBill.update).not.toHaveBeenCalled();
    });

    it('updates bill status and paymentMethod on happy path', async () => {
      const updated = { id: 'bill-1', status: 'SUCCESS', paymentMethod: 'CASH' };
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'PENDING',
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue(updated);

      const result = await service.updateBillStatus('bill-1', 'soc-1', 'SUCCESS', actor, 'CASH');

      expect(result).toEqual(updated);
      expect(mockPrisma.maintenanceBill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { status: 'SUCCESS', paymentMethod: 'CASH' },
        include: expect.objectContaining({ resident: expect.anything() }),
      });
    });

    it('omits paymentMethod from update when not provided', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'PENDING',
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue({ id: 'bill-1', status: 'WAIVED' });

      await service.updateBillStatus('bill-1', 'soc-1', 'WAIVED', actor);

      const callData = mockPrisma.maintenanceBill.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('paymentMethod');
    });

    it('maps PAID status to SUCCESS', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'PENDING',
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue({ id: 'bill-1', status: 'SUCCESS' });

      await service.updateBillStatus('bill-1', 'soc-1', 'PAID', actor, 'UPI');

      expect(mockPrisma.maintenanceBill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { status: 'SUCCESS', paymentMethod: 'UPI' },
        include: expect.anything(),
      });
    });
  });

  describe('getVisitors', () => {
    it('returns approvalStatus, validFrom, and qrToken', async () => {
      const validFrom = new Date('2026-05-24T08:00:00Z');
      mockPrisma.visitor.findMany.mockResolvedValue([
        {
          id: 'v1',
          name: 'Guest',
          phone: '9999',
          purpose: 'Visit',
          vehicleNo: 'KA01',
          status: 'EXPECTED',
          approvalStatus: 'PENDING',
          validFrom,
          validUntil: new Date('2026-05-24T20:00:00Z'),
          qrToken: 'QR123',
          entryAt: null,
          exitAt: null,
          createdAt: new Date(),
          resident: { user: { name: 'Resident A' }, flat: { number: '101', block: 'A' } },
        },
      ]);

      const result = await service.getVisitors('soc-1');

      expect(result[0]).toMatchObject({
        approvalStatus: 'PENDING',
        validFrom,
        qrToken: 'QR123',
        status: 'PENDING',
      });
    });
  });

  describe('updateResident', () => {
    it('throws NotFoundException when resident missing', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);
      await expect(service.updateResident('res-x', 'soc-1', { roleNote: 'n' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates fields and returns resident detail', async () => {
      mockPrisma.resident.findFirst
        .mockResolvedValueOnce({ id: 'res-1', userId: 'u1' })
        .mockResolvedValueOnce({
          id: 'res-1',
          userId: 'u1',
          type: 'OWNER',
          moveInDate: null,
          moveOutDate: null,
          roleNote: 'Committee',
          dateOfBirth: new Date('1950-01-01'),
          emergencyContact: null,
          createdAt: new Date(),
          user: { name: 'Alice', phone: '999', email: null, status: 'ACTIVE', societyId: 'soc-1' },
          flat: { id: 'f1', block: 'A', number: '101', floor: 1 },
        });
      mockPrisma.resident.update.mockResolvedValue({ id: 'res-1' });

      const result = await service.updateResident('res-1', 'soc-1', {
        roleNote: 'Committee',
        dateOfBirth: '1950-01-01',
      });

      expect(mockPrisma.resident.update).toHaveBeenCalled();
      expect(result).toMatchObject({ roleNote: 'Committee' });
    });
  });

  describe('approveLeave resignation flow', () => {
    it('auto-dismisses staff on RESIGNATION approval', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv1',
        status: LeaveStatus.PENDING,
        type: 'RESIGNATION',
        staffId: 'sm-1',
        staff: { societyId: 'soc-1', userId: 'u-staff' },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lv1', status: LeaveStatus.APPROVED });
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1', userId: 'u-staff' });
      mockPrisma.staffMember.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.approveLeave('lv1', 'soc-1');

      expect(mockPrisma.staffMember.update).toHaveBeenCalled();
    });

    it('skips dismiss for CASUAL leave', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv2',
        status: LeaveStatus.PENDING,
        type: 'CASUAL',
        staffId: 'sm-1',
        staff: { societyId: 'soc-1' },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lv2', status: LeaveStatus.APPROVED });

      await service.approveLeave('lv2', 'soc-1');

      expect(mockPrisma.staffMember.update).not.toHaveBeenCalled();
    });
  });

  describe('getStaffDetail', () => {
    it('returns pendingLoansCount for same-society staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'sm-1',
        societyId: 'soc-1',
        designation: 'Plumber',
        department: 'MAINTENANCE',
        categories: [],
        salaryStructure: null,
        joiningDate: new Date(),
        leavingDate: null,
        familyDetails: null,
        user: { name: 'Raj', phone: '999' },
      });
      mockPrisma.staffLoan.count.mockResolvedValue(3);

      const result = await service.getStaffDetail('sm-1', 'soc-1');

      expect(result.pendingLoansCount).toBe(3);
    });

    it('rejects cross-tenant access with CROSS_TENANT_ACCESS', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'sm-1',
        societyId: 'soc-other',
        designation: 'Plumber',
        user: { name: 'X', phone: '1' },
      });
      await expect(service.getStaffDetail('sm-1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CROSS_TENANT_ACCESS' }),
      });
    });
  });

  describe('updateStaff', () => {
    it('updates staff and user profile fields when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({
        id: 'sm-1',
        userId: 'u1',
        salaryStructure: { base: 10000 },
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.staffMember.update.mockResolvedValue({ id: 'sm-1', designation: 'Lead' });

      await service.updateStaff('soc-1', 'sm-1', {
        designation: 'Lead',
        department: 'MAINTENANCE',
        gender: 'MALE',
        dateOfBirth: '1990-01-01',
        salaryStructure: { hra: 2000 },
        familyDetails: [{ name: 'Spouse' }],
        leavingDate: null,
      });

      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
        where: { id: 'sm-1' },
        data: expect.objectContaining({ designation: 'Lead', department: 'MAINTENANCE' }),
        include: { user: true },
      });
    });

    it('throws NotFoundException when staff is in a different society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStaff('soc-1', 'staff-from-soc-B', { designation: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffMember.update).not.toHaveBeenCalled();
    });

    describe('shiftTemplateId', () => {
      // shiftTemplateId points at a template stored in JSON on Society.config.
      // No FK enforces it, so updateStaff must validate the id exists in the
      // society's template list before persisting.
      beforeEach(() => {
        mockPrisma.staffMember.findFirst.mockResolvedValue({
          id: 'sm-1',
          userId: 'u1',
          salaryStructure: {},
        });
        mockPrisma.user.update.mockResolvedValue({});
        mockPrisma.staffMember.update.mockResolvedValue({ id: 'sm-1' });
      });

      it('persists a valid shiftTemplateId after looking it up in society.config', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({
          config: {
            shiftTemplates: [
              { id: 'sh_morning', name: 'Morning', startTime: '06:00', endTime: '14:00' },
              { id: 'sh_night', name: 'Night', startTime: '22:00', endTime: '06:00' },
            ],
          },
        });

        await service.updateStaff('soc-1', 'sm-1', { shiftTemplateId: 'sh_morning' });

        expect(mockPrisma.society.findUnique).toHaveBeenCalledWith({
          where: { id: 'soc-1' },
          select: { config: true },
        });
        expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
          where: { id: 'sm-1' },
          data: expect.objectContaining({ shiftTemplateId: 'sh_morning' }),
          include: { user: true },
        });
      });

      it('rejects an unknown shiftTemplateId with BadRequestException', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({
          config: { shiftTemplates: [{ id: 'sh_morning' }] },
        });

        await expect(
          service.updateStaff('soc-1', 'sm-1', { shiftTemplateId: 'sh_does_not_exist' }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.staffMember.update).not.toHaveBeenCalled();
      });

      it('clears the shift when shiftTemplateId is null', async () => {
        await service.updateStaff('soc-1', 'sm-1', { shiftTemplateId: null });
        // Should NOT have consulted society.config — null skips the lookup.
        expect(mockPrisma.society.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
          where: { id: 'sm-1' },
          data: expect.objectContaining({ shiftTemplateId: null }),
          include: { user: true },
        });
      });

      it('treats empty string as a clear (same as null)', async () => {
        await service.updateStaff('soc-1', 'sm-1', { shiftTemplateId: '' });
        expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
          where: { id: 'sm-1' },
          data: expect.objectContaining({ shiftTemplateId: null }),
          include: { user: true },
        });
      });

      it('rejects when society has no shiftTemplates defined yet', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ config: {} });
        await expect(
          service.updateStaff('soc-1', 'sm-1', { shiftTemplateId: 'sh_morning' }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('staff documents — cross-tenant guards', () => {
    it('getStaffDocuments returns documents when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.findMany.mockResolvedValue([{ id: 'd1' }]);
      const docs = await service.getStaffDocuments('soc-1', 'sm-1');
      expect(docs).toHaveLength(1);
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
    });

    it('getStaffDocuments throws NotFound when staff belongs to another society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);
      await expect(
        service.getStaffDocuments('soc-1', 'staff-from-soc-B'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffDocument.findMany).not.toHaveBeenCalled();
    });

    it('addStaffDocument creates document when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.create.mockResolvedValue({ id: 'd1', documentType: 'AADHAR' });
      const doc = await service.addStaffDocument('soc-1', 'sm-1', 'AADHAR', 'https://file');
      expect(doc).toMatchObject({ documentType: 'AADHAR' });
      // Explicitly assert the composite WHERE so a regression to findUnique({id})
      // would fail this test (per advocate review feedback).
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
    });

    it('addStaffDocument throws NotFound when staff belongs to another society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);
      await expect(
        service.addStaffDocument('soc-1', 'staff-from-soc-B', 'AADHAR', 'https://file'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('dismissStaff', () => {
    it('sets leavingDate and suspends user when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1', userId: 'u1' });
      mockPrisma.staffMember.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.dismissStaff('soc-1', 'sm-1');
      expect(result).toEqual({ ok: true });
      // Lock in the composite WHERE so a regression to findUnique({id}) fails.
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'SUSPENDED' },
      });
    });

    it('throws NotFoundException when staff belongs to another society', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);
      await expect(
        service.dismissStaff('soc-1', 'staff-from-soc-B'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffMember.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivateStaff', () => {
    it('sets user status INACTIVE for same-society staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1', userId: 'u1', societyId: 'soc-1' });
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.deactivateStaff('sm-1', 'soc-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'INACTIVE' },
      });
    });
  });

  describe('getResidentDetail', () => {
    it('returns extended resident profile fields', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue({
        id: 'res-1',
        userId: 'u1',
        type: 'OWNER',
        moveInDate: null,
        moveOutDate: null,
        dateOfBirth: new Date('1950-01-01'),
        roleNote: 'Committee',
        appActivatedAt: new Date(),
        emergencyContact: { name: 'EC', phone: '111' },
        createdAt: new Date(),
        user: { name: 'Alice', phone: '999', email: null, status: 'ACTIVE' },
        flat: { id: 'f1', block: 'A', number: '101', floor: 1 },
      });

      const detail = await service.getResidentDetail('soc-1', 'res-1');

      expect(detail).toMatchObject({
        roleNote: 'Committee',
        appActivatedAt: expect.any(Date),
        emergencyContact: { name: 'EC', phone: '111' },
      });
    });
  });

  describe('approveLeave happy path', () => {
    it('approves pending leave without dismiss for casual type', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv1',
        status: LeaveStatus.PENDING,
        type: 'CASUAL',
        staffId: 'sm-1',
        staff: { societyId: 'soc-1' },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lv1', status: LeaveStatus.APPROVED });

      const result = await service.approveLeave('lv1', 'soc-1', 'ok');

      expect(result.status).toBe(LeaveStatus.APPROVED);
      expect(mockPrisma.leaveRequest.update).toHaveBeenCalled();
    });

    it('fires a LEAVE_APPROVED push to the staff member', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv1',
        status: LeaveStatus.PENDING,
        type: 'CASUAL',
        staffId: 'sm-1',
        staff: { societyId: 'soc-1', userId: 'u-staff' },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lv1', status: LeaveStatus.APPROVED });

      await service.approveLeave('lv1', 'soc-1');
      await new Promise((r) => setImmediate(r));

      expect(mockPush.send).toHaveBeenCalledWith(
        'u-staff',
        expect.objectContaining({ category: 'account_auth' }),
        expect.objectContaining({ type: 'LEAVE_APPROVED' }),
      );
    });
  });

  describe('rejectLeave push', () => {
    it('fires a LEAVE_REJECTED push to the staff member', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lv1',
        status: LeaveStatus.PENDING,
        type: 'CASUAL',
        staffId: 'sm-1',
        staff: { societyId: 'soc-1', userId: 'u-staff' },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lv1', status: LeaveStatus.REJECTED });

      await service.rejectLeave('lv1', 'soc-1');
      await new Promise((r) => setImmediate(r));

      expect(mockPush.send).toHaveBeenCalledWith(
        'u-staff',
        expect.objectContaining({ category: 'account_auth' }),
        expect.objectContaining({ type: 'LEAVE_REJECTED' }),
      );
    });
  });

  // ─── dismissResident ───────────────────────────────────────────────────────

  describe('dismissResident', () => {
    it('throws NotFoundException when resident not found or wrong society', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(service.dismissResident('res-missing', 'soc-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.resident.update).not.toHaveBeenCalled();
    });

    it('sets moveOutDate and status INACTIVE on happy path', async () => {
      const resident = { id: 'res-1', userId: 'u1', user: { id: 'u1' } };
      mockPrisma.resident.findFirst.mockResolvedValue(resident);
      mockPrisma.resident.update.mockResolvedValue({ id: 'res-1', moveOutDate: new Date() });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: 'INACTIVE' });

      const result = await service.dismissResident('res-1', 'soc-1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { moveOutDate: expect.any(Date) },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'INACTIVE' },
      });
    });
  });

  // ─── deleteResident ────────────────────────────────────────────────────────

  describe('deleteResident', () => {
    it('throws ForbiddenException when actor is SUPER_ADMIN', async () => {
      await expect(
        service.deleteResident('res-1', 'soc-1', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.resident.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when resident not found', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteResident('res-missing', 'soc-1', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.resident.update).not.toHaveBeenCalled();
    });

    it('soft-deletes resident by setting deletedAt', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1', userId: 'u1' });
      mockPrisma.resident.update.mockResolvedValue({ id: 'res-1', deletedAt: new Date() });

      const result = await service.deleteResident('res-1', 'soc-1', UserRole.ADMIN);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ─── approveResident / rejectResident — cross-tenant scoping ──────────────
  // These tests lock in the fix for the 2026-05 cross-tenant leak: a regular
  // admin (or SUPER_ADMIN with a stale tenant switch) could approve/reject a
  // resident from another society by knowing the id. The service now requires
  // a societyId arg and validates ownership via the composite WHERE.

  describe('approveResident — cross-tenant guard', () => {
    it('throws NotFoundException when the user id belongs to another society', async () => {
      // user lookup scoped to (id, societyId) returns nothing → resident
      // fallback also returns nothing → NotFoundException.
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(
        service.approveResident('soc-A', 'user-from-soc-B'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('approves when the user id belongs to the caller society', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', fcmToken: null });

      const result = await service.approveResident('soc-A', 'user-1');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', societyId: 'soc-A' },
        select: { id: true },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE' },
      });
      expect(result.status).toBe('ACTIVE');
    });

    it('falls back to residentId lookup and still scopes by user.societyId', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.resident.findFirst.mockResolvedValue({ userId: 'user-2' });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-2', status: 'ACTIVE', fcmToken: null });

      await service.approveResident('soc-A', 'resident-2');

      expect(mockPrisma.resident.findFirst).toHaveBeenCalledWith({
        where: { id: 'resident-2', user: { societyId: 'soc-A' } },
        select: { userId: true },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { status: 'ACTIVE' },
      });
    });
  });

  describe('rejectResident — cross-tenant guard', () => {
    it('throws NotFoundException when the user id belongs to another society', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(
        service.rejectResident('soc-A', 'user-from-soc-B', 'spam'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects with reason when user belongs to the caller society', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'REJECTED', fcmToken: null });

      await service.rejectResident('soc-A', 'user-1', 'incomplete docs');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'REJECTED', adminNote: 'incomplete docs' },
      });
    });
  });

  describe('getResidentDocuments — cross-tenant guard', () => {
    it('throws NotFoundException when resident belongs to another society', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(
        service.getResidentDocuments('soc-A', 'res-from-soc-B'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyResidentDocuments — cross-tenant guard', () => {
    it('throws NotFoundException when resident belongs to another society', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyResidentDocuments('soc-A', 'res-from-soc-B', 'VERIFIED'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.resident.update).not.toHaveBeenCalled();
    });

    it('updates documentsStatus when caller owns the resident', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1' });
      mockPrisma.resident.update.mockResolvedValue({ id: 'res-1', documentsStatus: 'VERIFIED' });

      await service.verifyResidentDocuments('soc-A', 'res-1', 'VERIFIED');

      expect(mockPrisma.resident.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { documentsStatus: 'VERIFIED' },
      });
    });
  });

  // ─── createResident ────────────────────────────────────────────────────────

  describe('createResident', () => {
    const dto = { name: 'Test User', email: 'test@example.com', phone: '9999999999', flatId: 'flat-1', type: 'OWNER' as const };

    it('throws BadRequestException when flat not found in society', async () => {
      mockPrisma.flat.findFirst.mockResolvedValue(null);

      await expect(service.createResident('soc-1', dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException when phone already exists in society', async () => {
      mockPrisma.flat.findFirst.mockResolvedValue({ id: 'flat-1', societyId: 'soc-1' });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-existing', phone: '9999999999' });

      await expect(service.createResident('soc-1', dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('creates user and resident on happy path', async () => {
      const createdUser = { id: 'u-new', phone: '9999999999', name: 'Test User', email: 'test@example.com', status: 'PENDING' };
      const createdResident = {
        id: 'res-new',
        userId: 'u-new',
        type: 'OWNER',
        createdAt: new Date(),
        user: createdUser,
        flat: { id: 'flat-1', block: 'A', number: '101' },
      };
      mockPrisma.flat.findFirst.mockResolvedValue({ id: 'flat-1', societyId: 'soc-1' });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.resident.create.mockResolvedValue(createdResident);

      const result = await service.createResident('soc-1', dto);

      expect(result).toMatchObject({ userId: 'u-new', type: 'OWNER' });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ phone: '9999999999', role: UserRole.RESIDENT, societyId: 'soc-1' }),
      });
    });
  });

  // ─── importResidentsCsv ────────────────────────────────────────────────────

  describe('importResidentsCsv', () => {
    it('throws BadRequestException for empty CSV', async () => {
      await expect(service.importResidentsCsv('soc-1', 'name,email,phone,flatNumber')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns created=1 skipped=0 for a fresh row', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });

      const csv = 'name,email,phone,flatNumber\nAlice,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result).toMatchObject({ created: 1, skipped: 0, errors: [], preview: false });
    });

    it('skips rows whose phone already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-existing' });

      const csv = 'name,email,phone,flatNumber\nBob,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result).toMatchObject({ created: 0, skipped: 1, errors: [], preview: false });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('records error row when name or phone missing', async () => {
      const csv = 'name,email,phone,flatNumber\n,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ row: 2, reason: 'Missing name or phone' });
    });

    it('creates resident linked to flat when flatNumber found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue({ id: 'flat-1' });
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });
      mockPrisma.resident.create.mockResolvedValue({ id: 'res-new' });

      const csv = 'name,email,phone,block,flatNumber,type\nCharlie,,1234567890,A,101,OWNER';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result.created).toBe(1);
      expect(mockPrisma.resident.create).toHaveBeenCalledWith({
        data: { userId: 'u-new', flatId: 'flat-1', type: 'OWNER' },
      });
    });
  });

  describe('createSociety', () => {
    it('throws BadRequestException when society fields missing', async () => {
      await expect(
        service.createSociety({
          name: '',
          address: 'Addr',
          city: 'City',
          pincode: '123456',
          adminName: 'Admin',
          adminPhone: '+919999999999',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when admin fields missing', async () => {
      await expect(
        service.createSociety({
          name: 'Test Society',
          address: 'Addr',
          city: 'City',
          pincode: '123456',
          adminName: '',
          adminPhone: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('importFlatsCsv', () => {
    it('creates flats from valid csv', async () => {
      mockPrisma.flat.findFirst.mockResolvedValue(null);
      mockPrisma.flat.create.mockResolvedValue({ id: 'flat-new' });

      const csv = 'block,floor,number,areaSqft\nA,1,101,1200';
      const result = await service.importFlatsCsv('soc-1', csv);

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.flat.create).toHaveBeenCalled();
    });

    it('skips duplicate flats', async () => {
      mockPrisma.flat.findFirst.mockResolvedValue({ id: 'existing' });

      const csv = 'block,floor,number\nA,1,101';
      const result = await service.importFlatsCsv('soc-1', csv);

      expect(result.skipped).toBe(1);
      expect(mockPrisma.flat.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteFlat', () => {
    it('throws when flat has active residents', async () => {
      mockPrisma.flat.findFirst.mockResolvedValue({
        id: 'flat-1',
        societyId: 'soc-1',
        residents: [{ id: 'res-1' }],
      });

      await expect(service.deleteFlat('soc-1', 'flat-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('archiveSociety', () => {
    it('throws NotFoundException when society missing', async () => {
      mockPrisma.society.findUnique.mockResolvedValue(null);
      await expect(service.archiveSociety('missing')).rejects.toThrow(NotFoundException);
    });

    it('archives society and deactivates users', async () => {
      mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', archivedAt: null });
      mockPrisma.society.update.mockResolvedValue({});
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.archiveSociety('soc-1');

      expect(result.archived).toBe(true);
      expect(mockPrisma.society.update).toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).toHaveBeenCalled();
    });
  });

  describe('createStaff society scoping', () => {
    it('rejects when phone already used in society', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-res', role: UserRole.RESIDENT });
      mockPrisma.staffMember.findUnique.mockResolvedValue(null);

      await expect(
        service.createStaff('soc-1', {
          phone: '+919876543210',
          name: 'Staff',
          designation: 'Guard',
          categories: ['SECURITY'],
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('importStaffCsv', () => {
    it('creates staff from valid csv row', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-staff' });
      mockPrisma.staffMember.create.mockResolvedValue({ id: 'sm-1' });

      const csv = 'name,phone,designation,department,categories,salary\nJohn,+919876543210,Guard,SECURITY,SECURITY,18000';
      const result = await service.importStaffCsv('soc-1', csv);

      expect(result.created).toBe(1);
    });
  });

  describe('staff document security', () => {
    it('deleteStaffDocument rejects cross-society access with NotFound (not 403)', async () => {
      // Returning 404 instead of 403 is intentional: we leak less info about
      // existence of records in other tenants.
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteStaffDocument('soc-1', 'sm-from-other-society', 'doc-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffDocument.delete).not.toHaveBeenCalled();
    });

    it('deleteStaffDocument succeeds when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.staffDocument.delete.mockResolvedValue({});

      const result = await service.deleteStaffDocument('soc-1', 'sm-1', 'doc-1');
      expect(result).toEqual({ deleted: true });
      // Composite WHERE lock-in.
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
      expect(mockPrisma.staffDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('verifyStaffDocument rejects cross-society access with NotFound', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyStaffDocument('soc-1', 'sm-from-other-society', 'doc-1', 'admin-u'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffDocument.update).not.toHaveBeenCalled();
    });

    it('verifyStaffDocument succeeds when society matches', async () => {
      mockPrisma.staffMember.findFirst.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.staffDocument.update.mockResolvedValue({ id: 'doc-1', verifiedAt: new Date() });

      const result = await service.verifyStaffDocument('soc-1', 'sm-1', 'doc-1', 'admin-u');
      expect(result).toHaveProperty('verifiedAt');
      // Composite WHERE lock-in.
      expect(mockPrisma.staffMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'sm-1', societyId: 'soc-1' },
        select: { id: true },
      });
      expect(mockPrisma.staffDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({ verifiedById: 'admin-u' }),
      });
    });
  });

  // Society lifecycle (SUPER_ADMIN) — added 2026-05.
  describe('society lifecycle', () => {
    describe('suspendSociety', () => {
      beforeEach(() => {
        mockPrisma.user.count.mockResolvedValue(0); // no super-admins in target by default
      });

      it('moves an ACTIVE society to SUSPENDED with reason + actor', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ACTIVE' });

        await service.suspendSociety('soc-1', 'super-1', 'unpaid invoices');

        expect(mockPrisma.society.update).toHaveBeenCalledWith({
          where: { id: 'soc-1' },
          data: expect.objectContaining({
            status: 'SUSPENDED',
            suspendedReason: 'unpaid invoices',
            suspendedById: 'super-1',
          }),
        });
      });

      it('refuses to suspend a society hosting any SUPER_ADMIN (self-lockout guard)', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-plat', status: 'ACTIVE' });
        mockPrisma.user.count.mockResolvedValue(1); // platform super-admin lives here
        await expect(service.suspendSociety('soc-plat', 'super-1')).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'PLATFORM_SOCIETY_PROTECTED' }),
        });
        expect(mockPrisma.society.update).not.toHaveBeenCalled();
      });

      it('rejects oversized reason (>500 chars)', async () => {
        const huge = 'x'.repeat(501);
        await expect(service.suspendSociety('soc-1', 'super-1', huge)).rejects.toThrow(
          BadRequestException,
        );
        // Fails before touching DB.
        expect(mockPrisma.society.findUnique).not.toHaveBeenCalled();
      });

      it('rejects double-suspend', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'SUSPENDED' });
        await expect(service.suspendSociety('soc-1', 'super-1')).rejects.toThrow(BadRequestException);
        expect(mockPrisma.society.update).not.toHaveBeenCalled();
      });

      it('refuses to suspend an ARCHIVED society — must be restored first', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ARCHIVED' });
        await expect(service.suspendSociety('soc-1', 'super-1')).rejects.toThrow(BadRequestException);
      });

      it('NotFoundException on missing society', async () => {
        mockPrisma.society.findUnique.mockResolvedValue(null);
        await expect(service.suspendSociety('soc-missing', 'super-1')).rejects.toThrow(NotFoundException);
      });
    });

    describe('resumeSociety', () => {
      it('clears suspension fields and returns society to ACTIVE', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'SUSPENDED' });

        await service.resumeSociety('soc-1');

        expect(mockPrisma.society.update).toHaveBeenCalledWith({
          where: { id: 'soc-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedReason: null,
            suspendedById: null,
          }),
        });
      });

      it('rejects resume on non-suspended societies (ACTIVE)', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ACTIVE' });
        await expect(service.resumeSociety('soc-1')).rejects.toThrow(BadRequestException);
      });

      it('rejects resume on archived societies', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ARCHIVED' });
        await expect(service.resumeSociety('soc-1')).rejects.toThrow(BadRequestException);
      });
    });

    describe('archiveSociety', () => {
      beforeEach(() => {
        mockPrisma.user.count.mockResolvedValue(0);
      });

      it('sets status=ARCHIVED, archivedAt, and deactivates members', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ACTIVE' });

        await service.archiveSociety('soc-1', 'super-1');

        // $transaction is mocked to resolve array of promises — assert the two updates queued.
        const societyUpdateCall = mockPrisma.society.update.mock.calls[0][0];
        expect(societyUpdateCall.data).toEqual(
          expect.objectContaining({ status: 'ARCHIVED', showInDirectory: false }),
        );
        expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
          where: { societyId: 'soc-1' },
          data: { status: 'INACTIVE' },
        });
      });

      it('rejects double-archive', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ARCHIVED' });
        await expect(service.archiveSociety('soc-1', 'super-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('refuses to archive a society hosting any SUPER_ADMIN', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-plat', status: 'ACTIVE' });
        mockPrisma.user.count.mockResolvedValue(1);
        await expect(service.archiveSociety('soc-plat', 'super-1')).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'PLATFORM_SOCIETY_PROTECTED' }),
        });
        expect(mockPrisma.society.update).not.toHaveBeenCalled();
      });
    });

    describe('restoreSociety', () => {
      it('clears archivedAt and returns society to ACTIVE', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ARCHIVED' });

        await service.restoreSociety('soc-1', 'super-1');

        expect(mockPrisma.society.update).toHaveBeenCalledWith({
          where: { id: 'soc-1' },
          data: expect.objectContaining({ status: 'ACTIVE', archivedAt: null }),
        });
      });

      it('rejects restore on non-archived societies', async () => {
        mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'SUSPENDED' });
        await expect(service.restoreSociety('soc-1', 'super-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('audit trail', () => {
      it('every lifecycle action records an AuditLog entry', async () => {
        mockPrisma.user.count.mockResolvedValue(0);

        mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'ACTIVE' });
        await service.suspendSociety('soc-1', 'super-1', 'demo');

        mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'SUSPENDED' });
        await service.resumeSociety('soc-1', 'super-1');

        mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'ACTIVE' });
        await service.archiveSociety('soc-1', 'super-1');

        mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'ARCHIVED' });
        await service.restoreSociety('soc-1', 'super-1');

        const actions = auditWriteSpy.mock.calls.map((c) => c[0].action);
        expect(actions).toEqual([
          'SOCIETY_SUSPENDED',
          'SOCIETY_RESUMED',
          'SOCIETY_ARCHIVED',
          'SOCIETY_RESTORED',
        ]);
        // Every audit entry should have an actor, an entityType, and the societyId.
        auditWriteSpy.mock.calls.forEach(([entry]) => {
          expect(entry).toMatchObject({
            entityType: 'Society',
            entityId: 'soc-1',
            actorId: 'super-1',
            societyId: 'soc-1',
          });
        });
      });
    });

    describe('getPlatformStats', () => {
      it('aggregates counts by status, totals users and flats, returns 5 most recent', async () => {
        mockPrisma.society.groupBy = jest.fn().mockResolvedValue([
          { status: 'ACTIVE', _count: { _all: 3 } },
          { status: 'SUSPENDED', _count: { _all: 1 } },
          { status: 'ARCHIVED', _count: { _all: 1 } },
        ]);
        mockPrisma.user.count.mockResolvedValue(42);
        mockPrisma.flat.count.mockResolvedValue(118);
        mockPrisma.society.findMany.mockResolvedValue([
          { id: 's1', name: 'Alpha', city: 'BLR', status: 'ACTIVE', createdAt: new Date(), _count: { users: 7 } },
        ]);

        const stats = await service.getPlatformStats();

        expect(stats.societies).toEqual({ total: 5, active: 3, suspended: 1, archived: 1 });
        expect(stats.users.total).toBe(42);
        expect(stats.flats.total).toBe(118);
        expect(stats.recentSocieties).toHaveLength(1);
        expect(stats.recentSocieties[0]).toMatchObject({ id: 's1', userCount: 7, status: 'ACTIVE' });
      });

      it('returns zeros when no societies exist', async () => {
        mockPrisma.society.groupBy = jest.fn().mockResolvedValue([]);
        mockPrisma.user.count.mockResolvedValue(0);
        mockPrisma.flat.count.mockResolvedValue(0);
        mockPrisma.society.findMany.mockResolvedValue([]);

        const stats = await service.getPlatformStats();

        expect(stats.societies).toEqual({ total: 0, active: 0, suspended: 0, archived: 0 });
        expect(stats.recentSocieties).toEqual([]);
      });
    });

    describe('listAllSocieties status filter', () => {
      it('passes through explicit status filter', async () => {
        mockPrisma.society.findMany.mockResolvedValue([]);
        await service.listAllSocieties({ status: 'SUSPENDED' });

        expect(mockPrisma.society.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: 'SUSPENDED' }) }),
        );
      });

      it('excludes ARCHIVED by default (no status, no includeArchived)', async () => {
        mockPrisma.society.findMany.mockResolvedValue([]);
        await service.listAllSocieties();

        expect(mockPrisma.society.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status: { not: 'ARCHIVED' } }),
          }),
        );
      });
    });
  });

  // ── H1: assignComplaint writes assignedToId, never clobbers adminNote ──
  describe('assignComplaint (H1)', () => {
    it('sets assignedToId and preserves adminNote, transitions OPEN → UNDER_REVIEW', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue({
        id: 'c1',
        societyId: 'soc-a',
        status: ComplaintStatus.OPEN,
        adminNote: 'existing note — must survive',
      });
      mockPrisma.staffMember.findFirst.mockResolvedValue({
        id: 'st-1',
        societyId: 'soc-a',
        user: { name: 'Sita' },
      });
      mockPrisma.complaint.update.mockResolvedValue({
        id: 'c1',
        assignedToId: 'st-1',
        status: ComplaintStatus.UNDER_REVIEW,
      });

      await service.assignComplaint('c1', 'soc-a', 'st-1');

      expect(mockPrisma.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            assignedToId: 'st-1',
            status: 'UNDER_REVIEW',
          }),
        }),
      );
      const updateCall = mockPrisma.complaint.update.mock.calls[0][0];
      expect(updateCall.data.adminNote).toBeUndefined();
    });

    it('rejects when staff belongs to a different society', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue({
        id: 'c1', societyId: 'soc-a', status: ComplaintStatus.OPEN,
      });
      mockPrisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(service.assignComplaint('c1', 'soc-a', 'st-foreign'))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── C3: transferStaff is super-admin scoped + audited ──
  describe('transferStaff (C3)', () => {
    const actor = { id: 'sa-1', role: 'SUPER_ADMIN' };

    beforeEach(() => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'st-1', userId: 'u-1', societyId: 'soc-a',
      });
      mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-b', status: 'ACTIVE' });
      mockPrisma.staffMember.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      auditWriteSpy.mockClear();
    });

    it('moves both StaffMember and User societyId in a transaction', async () => {
      await service.transferStaff('st-1', 'soc-a', 'soc-b', actor, 'restructure');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.staffMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { societyId: 'soc-b' } }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { societyId: 'soc-b' } }),
      );
      expect(auditWriteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STAFF_TRANSFERRED',
          before: { societyId: 'soc-a' },
          after: expect.objectContaining({ societyId: 'soc-b' }),
        }),
      );
    });

    it('rejects when staff is not in the source society', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'st-1', userId: 'u-1', societyId: 'soc-other',
      });
      await expect(
        service.transferStaff('st-1', 'soc-a', 'soc-b', actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'STAFF_SOCIETY_MISMATCH' }),
      });
    });

    it('rejects when target society is SUSPENDED', async () => {
      mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-b', status: 'SUSPENDED' });
      await expect(
        service.transferStaff('st-1', 'soc-a', 'soc-b', actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'TARGET_SOCIETY_INACTIVE' }),
      });
    });

    it('rejects no-op transfers (source === destination)', async () => {
      await expect(
        service.transferStaff('st-1', 'soc-a', 'soc-a', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── H4: updateBillStatus enforces transitions ──
  describe('updateBillStatus (H4)', () => {
    const adminActor = { id: 'ad-1', role: 'ADMIN' };
    const superActor = { id: 'sa-1', role: 'SUPER_ADMIN' };

    beforeEach(() => {
      mockPrisma.maintenanceBill.update.mockResolvedValue({});
      auditWriteSpy.mockClear();
    });

    it('rejects SUCCESS → PENDING for a regular ADMIN', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'b1', status: 'SUCCESS', flat: { societyId: 'soc-a' },
      });
      await expect(
        service.updateBillStatus('b1', 'soc-a', 'PENDING', adminActor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_BILL_TRANSITION', requiresSuperAdmin: true }),
      });
    });

    it('allows SUCCESS → PENDING for SUPER_ADMIN and audits with before/after', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'b1', status: 'SUCCESS', flat: { societyId: 'soc-a' }, paymentMethod: 'card',
      });
      await service.updateBillStatus('b1', 'soc-a', 'PENDING', superActor);
      expect(auditWriteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BILL_STATUS_CHANGED',
          before: expect.objectContaining({ status: 'SUCCESS' }),
          after: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('allows the normal PENDING → SUCCESS path and writes audit', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'b1', status: 'PENDING', flat: { societyId: 'soc-a' },
      });
      await service.updateBillStatus('b1', 'soc-a', 'SUCCESS', adminActor, 'upi');
      expect(mockPrisma.maintenanceBill.update).toHaveBeenCalled();
      expect(auditWriteSpy).toHaveBeenCalled();
    });
  });

  // ── H2: SOS recipient id is a UUID, not Date.now() ──
  describe('addSosRecipient (H2)', () => {
    it('generates a UUID-bearing id (no millisecond collision)', async () => {
      mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-a', config: {} });
      mockPrisma.society.update.mockResolvedValue({});
      const r1 = await service.addSosRecipient('soc-a', { name: 'A', phone: '1' });
      const r2 = await service.addSosRecipient('soc-a', { name: 'B', phone: '2' });
      expect(r1.id).not.toEqual(r2.id);
      // sos_<uuid> — 4 hyphens in v4 UUID
      expect(r1.id).toMatch(/^sos_[0-9a-f-]{36}$/i);
    });
  });

  // ─── createBuildingAdmin (society-wide admins; no block scoping) ─────────────

  describe('createBuildingAdmin', () => {
    it('creates a society-wide ADMIN with no block scoping', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(({ data }: any) => ({ id: 'u-new', ...data }));

      await service.createBuildingAdmin('soc-1', { name: 'Asha', phone: '+919000000001' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.ADMIN,
            managedBlocks: [],
            societyId: 'soc-1',
          }),
        }),
      );
    });

    it('conflicts when phone already exists in society', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

      await expect(
        service.createBuildingAdmin('soc-1', { name: 'Dup', phone: '+919000000005' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('listBuildingAdmins', () => {
    it('returns both society admins and building admins', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.listBuildingAdmins('soc-1');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            societyId: 'soc-1',
            role: { in: [UserRole.ADMIN, UserRole.BUILDING_ADMIN] },
          }),
        }),
      );
    });
  });

  describe('removeBuildingAdmin', () => {
    it('removes a society ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: UserRole.ADMIN });
      mockPrisma.user.delete.mockResolvedValue({});
      await expect(service.removeBuildingAdmin('u1')).resolves.toEqual({ success: true });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('removes a BUILDING_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', role: UserRole.BUILDING_ADMIN });
      mockPrisma.user.delete.mockResolvedValue({});
      await expect(service.removeBuildingAdmin('u2')).resolves.toEqual({ success: true });
    });

    it('refuses to remove a SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u3', role: UserRole.SUPER_ADMIN });
      await expect(service.removeBuildingAdmin('u3')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Infrastructure ─────────────────────────────────────────────────────────

  describe('createInfrastructureItem', () => {
    it('creates an item, uppercasing type and defaulting status to OPERATIONAL', async () => {
      mockPrisma.infrastructureItem.create.mockImplementation(({ data }: any) => ({ id: 'i1', ...data }));

      await service.createInfrastructureItem('soc-1', { name: 'Main Lift', type: 'lift' });

      expect(mockPrisma.infrastructureItem.create).toHaveBeenCalledWith({
        data: {
          societyId: 'soc-1',
          name: 'Main Lift',
          type: InfrastructureType.LIFT,
          status: InfrastructureStatus.OPERATIONAL,
        },
      });
    });

    it('rejects an invalid type', async () => {
      await expect(
        service.createInfrastructureItem('soc-1', { name: 'X', type: 'ELEVATOR' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.infrastructureItem.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid status', async () => {
      await expect(
        service.createInfrastructureItem('soc-1', { name: 'X', type: 'LIFT', status: 'BROKEN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('importInfrastructureCsv', () => {
    it('throws BadRequestException for header-only CSV', async () => {
      await expect(service.importInfrastructureCsv('soc-1', 'name,type,status')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates valid rows and records errors for invalid type', async () => {
      mockPrisma.infrastructureItem.findFirst.mockResolvedValue(null);
      mockPrisma.infrastructureItem.create.mockResolvedValue({ id: 'i1' });

      const csv =
        'name,type,status\n' +
        'Lift A,LIFT,OPERATIONAL\n' +
        'Bad One,ELEVATOR,OPERATIONAL\n';
      const result = await service.importInfrastructureCsv('soc-1', csv);

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ row: 3 });
    });

    it('skips rows whose name already exists', async () => {
      mockPrisma.infrastructureItem.findFirst.mockResolvedValue({ id: 'existing' });

      const csv = 'name,type,status\nLift A,LIFT,OPERATIONAL\n';
      const result = await service.importInfrastructureCsv('soc-1', csv);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockPrisma.infrastructureItem.create).not.toHaveBeenCalled();
    });

    it('does not write in preview mode', async () => {
      mockPrisma.infrastructureItem.findFirst.mockResolvedValue(null);

      const csv = 'name,type,status\nLift A,LIFT,OPERATIONAL\n';
      const result = await service.previewInfrastructureCsv('soc-1', csv);

      expect(result.preview).toBe(true);
      expect(result.valid).toHaveLength(1);
      expect(mockPrisma.infrastructureItem.create).not.toHaveBeenCalled();
    });
  });

  // ─── Domestic help / pest control (society-wide getters) ────────────────────

  describe('getDomesticHelpers', () => {
    it('scopes the query to the society via flat relation', async () => {
      mockPrisma.domesticHelp.findMany.mockResolvedValue([]);
      await service.getDomesticHelpers('soc-1');
      expect(mockPrisma.domesticHelp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resident: { flat: { societyId: 'soc-1' } } },
        }),
      );
    });
  });

  describe('getPestControlJobs', () => {
    it('returns all jobs for the society newest-first', async () => {
      mockPrisma.pestControlSchedule.findMany.mockResolvedValue([]);
      await service.getPestControlJobs('soc-1');
      expect(mockPrisma.pestControlSchedule.findMany).toHaveBeenCalledWith({
        where: { societyId: 'soc-1' },
        orderBy: { scheduledAt: 'desc' },
      });
    });
  });

  // ─── CSV: dateOfBirth in resident import ────────────────────────────────────

  describe('processResidentsCsv (dateOfBirth)', () => {
    it('passes dateOfBirth to user.create when the column is present', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });

      const csv = 'name,phone,dateOfBirth\nAlice,9876543210,1990-05-01';
      await service.importResidentsCsv('soc-1', csv);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dateOfBirth: new Date('1990-05-01') }),
        }),
      );
    });

    it('leaves dateOfBirth undefined when the column is absent', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });

      const csv = 'name,phone\nBob,9876543211';
      await service.importResidentsCsv('soc-1', csv);

      const arg = mockPrisma.user.create.mock.calls[0][0];
      expect(arg.data.dateOfBirth).toBeUndefined();
    });
  });
});
