import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ComplaintStatus, LeaveStatus, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AuditService } from '../../common/audit/audit.service';

const mockPrisma = {
  complaint: { findUnique: jest.fn(), update: jest.fn() },
  leaveRequest: { findUnique: jest.fn(), update: jest.fn() },
  visitor: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  resident: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  flat: { findFirst: jest.fn() },
  staffMember: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  staffDocument: { findMany: jest.fn(), create: jest.fn() },
  staffLoan: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  maintenanceBill: { findUnique: jest.fn(), update: jest.fn() },
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: { sendToToken: jest.fn() } },
        { provide: PushService, useValue: { send: jest.fn() } },
        { provide: ComplianceService, useValue: { dataExport: jest.fn() } },
        { provide: AuditService, useValue: { write: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
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
    it('throws NotFoundException when staff not found', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue(null);

      await expect(service.getStaffLoans('staff-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffLoan.findMany).not.toHaveBeenCalled();
    });

    it('returns loans for the staff member', async () => {
      const loans = [{ id: 'loan-1', staffMemberId: 'sm-1', amount: 5000 }];
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1', societyId: 'soc-1' });
      mockPrisma.staffLoan.findMany.mockResolvedValue(loans);

      const result = await service.getStaffLoans('sm-1');

      expect(result).toEqual(loans);
      expect(mockPrisma.staffLoan.findMany).toHaveBeenCalledWith({
        where: { staffMemberId: 'sm-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ─── createStaffLoan ───────────────────────────────────────────────────────

  describe('createStaffLoan', () => {
    it('throws NotFoundException when staff not found', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue(null);

      await expect(service.createStaffLoan('staff-missing', 1000)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staffLoan.create).not.toHaveBeenCalled();
    });

    it('creates a loan record with default PENDING status', async () => {
      const created = { id: 'loan-1', staffMemberId: 'sm-1', amount: 2000, status: 'PENDING' };
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffLoan.create.mockResolvedValue(created);

      const result = await service.createStaffLoan('sm-1', 2000, 'emergency');

      expect(result).toEqual(created);
      expect(mockPrisma.staffLoan.create).toHaveBeenCalledWith({
        data: {
          staffMemberId: 'sm-1',
          amount: 2000,
          reason: 'emergency',
          status: 'PENDING',
        },
      });
    });

    it('creates a loan with explicit status when provided', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffLoan.create.mockResolvedValue({ id: 'loan-2', status: 'APPROVED' });

      await service.createStaffLoan('sm-1', 3000, undefined, 'APPROVED');

      expect(mockPrisma.staffLoan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'APPROVED' }),
      });
    });
  });

  // ─── updateBillStatus ──────────────────────────────────────────────────────

  describe('updateBillStatus', () => {
    it('throws BadRequestException for invalid status', async () => {
      await expect(service.updateBillStatus('bill-1', 'soc-1', 'INVALID')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.maintenanceBill.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when bill not found', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue(null);

      await expect(service.updateBillStatus('bill-missing', 'soc-1', 'SUCCESS')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.maintenanceBill.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when bill belongs to another society', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        flat: { societyId: 'soc-other' },
      });

      await expect(service.updateBillStatus('bill-1', 'soc-1', 'SUCCESS')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.maintenanceBill.update).not.toHaveBeenCalled();
    });

    it('updates bill status and paymentMethod on happy path', async () => {
      const updated = { id: 'bill-1', status: 'SUCCESS', paymentMethod: 'CASH' };
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue(updated);

      const result = await service.updateBillStatus('bill-1', 'soc-1', 'SUCCESS', 'CASH');

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
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue({ id: 'bill-1', status: 'WAIVED' });

      await service.updateBillStatus('bill-1', 'soc-1', 'WAIVED');

      const callData = mockPrisma.maintenanceBill.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('paymentMethod');
    });

    it('maps PAID status to SUCCESS', async () => {
      mockPrisma.maintenanceBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.maintenanceBill.update.mockResolvedValue({ id: 'bill-1', status: 'SUCCESS' });

      await service.updateBillStatus('bill-1', 'soc-1', 'PAID', 'UPI');

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
    it('returns pendingLoansCount', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'sm-1',
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

      const result = await service.getStaffDetail('sm-1');

      expect(result.pendingLoansCount).toBe(3);
    });
  });

  describe('updateStaff', () => {
    it('updates staff and user profile fields', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 'sm-1',
        userId: 'u1',
        salaryStructure: { base: 10000 },
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.staffMember.update.mockResolvedValue({ id: 'sm-1', designation: 'Lead' });

      await service.updateStaff('sm-1', {
        designation: 'Lead',
        department: 'MAINTENANCE',
        gender: 'MALE',
        dateOfBirth: '1990-01-01',
        salaryStructure: { hra: 2000 },
        familyDetails: [{ name: 'Spouse' }],
        leavingDate: null,
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
        where: { id: 'sm-1' },
        data: expect.objectContaining({ designation: 'Lead', department: 'MAINTENANCE' }),
        include: { user: true },
      });
    });

    it('throws when staff not found', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue(null);
      await expect(service.updateStaff('missing', { designation: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('staff documents', () => {
    it('getStaffDocuments returns documents for staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.findMany.mockResolvedValue([{ id: 'd1' }]);
      const docs = await service.getStaffDocuments('sm-1');
      expect(docs).toHaveLength(1);
    });

    it('addStaffDocument creates document record', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.staffDocument.create.mockResolvedValue({ id: 'd1', documentType: 'AADHAR' });
      const doc = await service.addStaffDocument('sm-1', 'AADHAR', 'https://file');
      expect(doc).toMatchObject({ documentType: 'AADHAR' });
    });
  });

  describe('dismissStaff', () => {
    it('sets leavingDate and suspends user', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1', userId: 'u1' });
      mockPrisma.staffMember.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.dismissStaff('sm-1');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'SUSPENDED' },
      });
    });
  });

  describe('deactivateStaff', () => {
    it('sets user status INACTIVE', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'sm-1', userId: 'u1' });
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.deactivateStaff('sm-1');
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
      await expect(service.importResidentsCsv('soc-1', 'Name,Email,Phone,Flat')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns created=1 skipped=0 for a fresh row', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });

      const csv = 'Name,Email,Phone,Flat\nAlice,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result).toEqual({ created: 1, skipped: 0, errors: [] });
    });

    it('skips rows whose phone already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-existing' });

      const csv = 'Name,Email,Phone,Flat\nBob,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result).toEqual({ created: 0, skipped: 1, errors: [] });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('records error row when name or phone missing', async () => {
      const csv = 'Name,Email,Phone,Flat\n,,9876543210,';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ row: 2, reason: 'Missing name or phone' });
    });

    it('creates resident linked to flat when flatNumber found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.flat.findFirst.mockResolvedValue({ id: 'flat-1' });
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });
      mockPrisma.resident.create.mockResolvedValue({ id: 'res-new' });

      const csv = 'Name,Email,Phone,Flat\nCharlie,,1234567890,101';
      const result = await service.importResidentsCsv('soc-1', csv);

      expect(result.created).toBe(1);
      expect(mockPrisma.resident.create).toHaveBeenCalledWith({
        data: { userId: 'u-new', flatId: 'flat-1', type: 'TENANT' },
      });
    });
  });
});
