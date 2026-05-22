import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ComplaintStatus, LeaveStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AuditService } from '../../common/audit/audit.service';

const mockPrisma = {
  complaint: { findUnique: jest.fn(), update: jest.fn() },
  leaveRequest: { findUnique: jest.fn(), update: jest.fn() },
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
});
