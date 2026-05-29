import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceRequestStatus, ServicePhase } from '@prisma/client';
import { S3Service } from '../../common/storage/s3.service';
import { ServiceRequestGateway } from './service-request.gateway';
import { NotificationService } from '../notification/notification.service';

const mockNotification = {
  notifyUser: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  resident: { findUnique: jest.fn(), findFirst: jest.fn() },
  flat: { findUnique: jest.fn() },
  society: { findUnique: jest.fn().mockResolvedValue({ id: 'soc-1', config: {} }) },
  staffMember: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  serviceRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  servicePhoto: { create: jest.fn() },
  taskNote: { create: jest.fn() },
  $transaction: jest.fn(),
} as any;

const mockS3 = {
  getPresignedUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://bucket/upload',
    key: 'k1',
    publicUrl: 'https://bucket/public/k1',
  }),
  getPublicUrl: jest.fn((k: string) => `https://bucket/${k}`),
};

const mockGateway = {
  emitTaskAssigned: jest.fn(),
  emitTaskUpdated: jest.fn(),
};

describe('ServiceRequestService', () => {
  let service: ServiceRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: ServiceRequestGateway, useValue: mockGateway },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<ServiceRequestService>(ServiceRequestService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) => cb(mockPrisma));
  });

  describe('create', () => {
    it('creates a service request with residentId and societyId', async () => {
      const dto = { category: 'PLUMBING', description: 'Leaking pipe' };
      const created = { id: 'sr-1', residentId: 'res-1', societyId: 'soc-1', assignedToIds: [], ...dto };
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1', flatId: 'flat-1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'flat-1', societyId: 'soc-1' });
      mockPrisma.serviceRequest.create.mockResolvedValue(created);

      const result = await service.create('user-1', 'soc-1', dto as any);

      expect(result).toMatchObject({ ...created, assignedTo: null, assignedStaff: [] });
      expect(mockPrisma.serviceRequest.create).toHaveBeenCalledWith({
        data: { residentId: 'res-1', societyId: 'soc-1', ...dto },
        include: { photos: true },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when request does not exist', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the service request when found', async () => {
      const sr = {
        id: 'sr-1',
        status: 'PENDING',
        societyId: 'soc-1',
        assignedToIds: [],
        resident: { include: { user: true, flat: true } },
        photos: [],
      };
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(sr);

      const result = await service.findOne('sr-1');

      expect(result).toMatchObject({ ...sr, assignedTo: null, assignedStaff: [] });
    });

    it('throws when societyId does not match', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'other',
        resident: {},
        assignedTo: null,
        photos: [],
      });

      await expect(service.findOne('sr-1', { societyId: 'soc-1' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('sets resolvedAt when status is COMPLETED', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.IN_PROGRESS,
        acceptedAt: new Date(),
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', status: 'COMPLETED' });

      await service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.COMPLETED });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ resolvedAt: expect.any(Date), status: ServiceRequestStatus.COMPLETED }),
      });
    });

    it('does not set resolvedAt for non-COMPLETED transitions', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', status: 'IN_PROGRESS' });

      await service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.ASSIGNED });

      const callArg = mockPrisma.serviceRequest.update.mock.calls[0][0];
      expect(callArg.data.resolvedAt).toBeUndefined();
    });

    it('throws ConflictException on invalid transition', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
      });

      await expect(
        service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.PENDING }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rate', () => {
    it('throws ForbiddenException if resident does not own the request', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'other-res',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
        resident: { include: { user: true, flat: true } },
        assignedTo: null,
        photos: [],
      });

      await expect(service.rate('sr-1', 'user-1', 'soc-1', { rating: 5 } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if request is not COMPLETED', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.IN_PROGRESS,
        resident: { include: { user: true, flat: true } },
        assignedTo: null,
        photos: [],
      });

      await expect(service.rate('sr-1', 'user-1', 'soc-1', { rating: 4 } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('saves rating when request is completed and resident matches', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1', flatId: 'flat-1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'flat-1', societyId: 'soc-1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
        resident: { include: { user: true, flat: true } },
        assignedTo: null,
        photos: [],
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', rating: 5 });

      const result = await service.rate('sr-1', 'user-1', 'soc-1', { rating: 5, note: 'Great work' } as any);

      expect(result).toEqual({ id: 'sr-1', rating: 5 });
      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { rating: 5, ratingNote: 'Great work', ratedAt: expect.any(Date) },
      });
    });
  });

  describe('adminCreate', () => {
    it('creates request on behalf of resident', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1', flat: {} });
      mockPrisma.serviceRequest.create.mockResolvedValue({
        id: 'sr-new',
        societyId: 'soc-1',
        residentId: 'res-1',
        category: 'PLUMBING',
        description: 'Leak',
        assignedToIds: [],
        resident: { user: {}, flat: {} },
      });

      const result = await service.adminCreate('soc-1', {
        residentId: 'res-1',
        category: 'PLUMBING',
        description: 'Leak',
        isPaid: true,
        reminderMinutes: 30,
      } as any);

      expect(result).toMatchObject({ category: 'PLUMBING', assignedStaff: [] });
      expect(mockPrisma.serviceRequest.create).toHaveBeenCalled();
    });

    it('throws when resident not in society', async () => {
      mockPrisma.resident.findFirst.mockResolvedValue(null);
      await expect(
        service.adminCreate('soc-1', { residentId: 'x', category: 'X', description: 'Y' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminUpdate', () => {
    it('updates editable fields and resets reminderSentAt when reminder changes', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        deletedAt: null,
        assignedToIds: [],
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({
        id: 'sr-1',
        category: 'ELECTRICAL',
        description: 'Fixed',
        assignedToIds: [],
        resident: { user: {}, flat: {} },
        photos: [],
      });

      await service.adminUpdate('sr-1', 'soc-1', {
        category: 'ELECTRICAL',
        description: 'Fixed',
        reminderMinutes: 15,
      });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({
          category: 'ELECTRICAL',
          reminderMinutes: 15,
          reminderSentAt: null,
        }),
        include: expect.anything(),
      });
    });

    it('throws when request is soft-deleted', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        deletedAt: new Date(),
      });
      await expect(service.adminUpdate('sr-1', 'soc-1', { category: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTags', () => {
    it('persists tags array', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        deletedAt: null,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', tags: ['urgent'] });

      await service.updateTags('sr-1', 'soc-1', ['urgent']);

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { tags: ['urgent'] },
      });
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt timestamp', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        deletedAt: null,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', deletedAt: new Date() });

      await service.softDelete('sr-1', 'soc-1');

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('assignStaff', () => {
    const baseReq = { id: 'sr-1', societyId: 'soc-1', status: ServiceRequestStatus.PENDING, category: 'PLUMBING', description: 'Fix' };

    it('assigns multiple staff and emits gateway events', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([
        { id: 's1', societyId: 'soc-1', deletedAt: null },
        { id: 's2', societyId: 'soc-1', deletedAt: null },
      ]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(baseReq);
      mockPrisma.serviceRequest.count.mockResolvedValue(0);
      mockPrisma.serviceRequest.update.mockResolvedValue({
        ...baseReq,
        assignedToIds: ['s1', 's2'],
        status: ServiceRequestStatus.ASSIGNED,
      });

      const result = await service.assignStaff('sr-1', 'soc-1', ['s1', 's2']);

      expect(result).toMatchObject({ assignedToIds: ['s1', 's2'] });
      expect(mockGateway.emitTaskAssigned).toHaveBeenCalledTimes(2);
    });

    it('throws when no staff ids provided', async () => {
      await expect(service.assignStaff('sr-1', 'soc-1', [])).rejects.toThrow(BadRequestException);
    });

    it('throws STAFF_OVERLOADED when staff has 3+ active tasks', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', societyId: 'soc-1', deletedAt: null }]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(baseReq);
      mockPrisma.serviceRequest.count.mockResolvedValue(3);

      await expect(service.assignStaff('sr-1', 'soc-1', ['s1'])).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'STAFF_OVERLOADED' }),
      });
    });
  });

  describe('autoAssign', () => {
    it('prefers staff matching request category', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        category: 'PLUMBING',
        description: 'Leak',
      });
      mockPrisma.staffMember.findMany.mockResolvedValue([
        { id: 's-plumber', societyId: 'soc-1', deletedAt: null, categories: ['PLUMBING'] },
        { id: 's-other', societyId: 'soc-1', deletedAt: null, categories: ['ELECTRICAL'] },
      ]);
      mockPrisma.serviceRequest.count.mockResolvedValue(0);
      mockPrisma.serviceRequest.update.mockResolvedValue({
        id: 'sr-1',
        assignedToIds: ['s-plumber'],
        category: 'PLUMBING',
        description: 'Leak',
      });

      await service.autoAssign('sr-1', 'soc-1');

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ assignedToIds: ['s-plumber'], autoAssigned: true }),
      });
    });

    it('throws when no staff available', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        category: 'X',
        description: 'Y',
      });
      mockPrisma.staffMember.findMany.mockResolvedValue([]);

      await expect(service.autoAssign('sr-1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'NO_STAFF' }),
      });
    });
  });

  describe('assignStaffWithSchedule', () => {
    it('sets scheduledTime after assignment', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', societyId: 'soc-1', deletedAt: null }]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        category: 'X',
        description: 'Y',
      });
      mockPrisma.serviceRequest.count.mockResolvedValue(0);
      mockPrisma.serviceRequest.update
        .mockResolvedValueOnce({ id: 'sr-1', assignedToIds: ['s1'], category: 'X', description: 'Y' })
        .mockResolvedValueOnce({ id: 'sr-1', assignedToIds: ['s1'], scheduledTime: new Date('2026-06-01T10:00:00Z') });

      await service.assignStaffWithSchedule('sr-1', 'soc-1', ['s1'], '2026-06-01T10:00:00.000Z');

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendDueReminders', () => {
    it('notifies resident and assigned staff when reminder window reached', async () => {
      const scheduledTime = new Date(Date.now() + 5 * 60_000);
      mockPrisma.serviceRequest.findMany.mockResolvedValue([
        {
          id: 'sr-1',
          societyId: 'soc-1',
          category: 'PLUMBING',
          scheduledTime,
          reminderMinutes: 10,
          assignedToIds: ['s1'],
          resident: { userId: 'u-res' },
        },
      ]);
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', userId: 'u-staff' }]);
      mockPrisma.serviceRequest.update.mockResolvedValue({});

      await service.sendDueReminders();

      expect(mockNotification.notifyUser).toHaveBeenCalledTimes(2);
      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('batch-loads staff via findMany (no N+1 findUnique) — 3 assignees + 1 missing', async () => {
      const scheduledTime = new Date(Date.now() + 5 * 60_000);
      mockPrisma.serviceRequest.findMany.mockResolvedValue([
        {
          id: 'sr-1',
          societyId: 'soc-1',
          category: 'PLUMBING',
          scheduledTime,
          reminderMinutes: 10,
          assignedToIds: ['s1', 's2', 's3', 's-missing'],
          resident: { userId: 'u-res' },
        },
      ]);
      // Note: s-missing intentionally not returned to assert graceful skip.
      mockPrisma.staffMember.findMany.mockResolvedValue([
        { id: 's1', userId: 'u-staff-1' },
        { id: 's2', userId: 'u-staff-2' },
        { id: 's3', userId: 'u-staff-3' },
      ]);
      mockPrisma.serviceRequest.update.mockResolvedValue({});

      await service.sendDueReminders();

      // Critical: findUnique must NOT be called for the per-staff lookup.
      expect(mockPrisma.staffMember.findUnique).not.toHaveBeenCalled();
      // findMany should be called exactly once with all assignee ids.
      expect(mockPrisma.staffMember.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.staffMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['s1', 's2', 's3', 's-missing'] },
            societyId: 'soc-1',
          }),
        }),
      );
      // 1 resident + 3 found staff = 4 notifications. s-missing skipped silently.
      expect(mockNotification.notifyUser).toHaveBeenCalledTimes(4);
    });

    it('skips requests whose reminder time is still in the future', async () => {
      mockPrisma.serviceRequest.findMany.mockResolvedValue([
        {
          id: 'sr-2',
          societyId: 'soc-1',
          category: 'X',
          scheduledTime: new Date(Date.now() + 60 * 60_000),
          reminderMinutes: 30,
          assignedToIds: [],
          resident: { userId: 'u-res' },
        },
      ]);

      await service.sendDueReminders();

      expect(mockNotification.notifyUser).not.toHaveBeenCalled();
    });
  });

  describe('findByStaff', () => {
    it('returns tasks assigned to staff member', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 's1', societyId: 'soc-1' });
      mockPrisma.serviceRequest.findMany.mockResolvedValue([
        { id: 'sr-1', assignedToIds: ['s1'], resident: { user: {}, flat: {} }, photos: [] },
      ]);

      const rows = await service.findByStaff('user-staff', 'soc-1');

      expect(rows).toHaveLength(1);
      expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ assignedToIds: { has: 's1' } }) }),
      );
    });
  });

  describe('staff task helpers', () => {
    const assignedSr = {
      id: 'sr-1',
      societyId: 'soc-1',
      status: ServiceRequestStatus.IN_PROGRESS,
      assignedToIds: ['s1'],
      adminNote: null,
      resident: { user: {}, flat: {} },
      photos: [],
    };

    beforeEach(() => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 's1', userId: 'u-staff' });
    });

    it('getPhotoUploadUrl returns presigned url for assigned staff', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(assignedSr);
      const out = await service.getPhotoUploadUrl('sr-1', 'u-staff', 'soc-1', 'BEFORE');
      expect(out).toMatchObject({ url: expect.any(String), key: 'k1' });
    });

    it('confirmPhoto creates service photo with DISPUTE normalized to DURING', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(assignedSr);
      mockPrisma.servicePhoto.create.mockResolvedValue({ id: 'p1' });
      await service.confirmPhoto('sr-1', 'u-staff', 'soc-1', 'key1', 'DISPUTE');
      expect(mockPrisma.servicePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ phase: ServicePhase.DURING }),
      });
    });

    it('completeWork marks request COMPLETED with photos', async () => {
      mockPrisma.serviceRequest.findUnique
        .mockResolvedValueOnce(assignedSr)
        .mockResolvedValueOnce({ ...assignedSr, status: ServiceRequestStatus.COMPLETED, deletedAt: null });
      mockPrisma.servicePhoto.create.mockResolvedValue({});
      mockPrisma.serviceRequest.update.mockResolvedValue({});

      await service.completeWork('sr-1', 'u-staff', 'soc-1', ['photo-key'], 'Done');

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalled();
    });

    it('addPhoto creates photo record directly', async () => {
      mockPrisma.servicePhoto.create.mockResolvedValue({ id: 'p1' });
      await service.addPhoto('sr-1', 'AFTER', 'https://img');
      expect(mockPrisma.servicePhoto.create).toHaveBeenCalled();
    });

    it('getVoiceUploadUrl returns presigned voice url', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(assignedSr);
      const out = await service.getVoiceUploadUrl('sr-1', 'u-staff', 'soc-1');
      expect(out.key).toBe('k1');
    });

    it('addTaskNote creates note for assigned staff', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(assignedSr);
      mockPrisma.taskNote.create.mockResolvedValue({ id: 'n1' });
      await service.addTaskNote('sr-1', 'u-staff', 'soc-1', 'Note body');
      expect(mockPrisma.taskNote.create).toHaveBeenCalled();
    });

    it('completeWork rejects when status is not IN_PROGRESS', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        ...assignedSr,
        status: ServiceRequestStatus.ASSIGNED,
      });
      await expect(service.completeWork('sr-1', 'u-staff', 'soc-1', [])).rejects.toThrow(ConflictException);
    });

    it('proof delegates to confirmPhoto with BEFORE phase', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(assignedSr);
      mockPrisma.servicePhoto.create.mockResolvedValue({ id: 'p1' });
      await service.proof('sr-1', 'u-staff', 'soc-1', 'key1');
      expect(mockPrisma.servicePhoto.create).toHaveBeenCalled();
    });

    it('disputeResponse appends admin note and optional photos', async () => {
      mockPrisma.serviceRequest.findUnique
        .mockResolvedValueOnce({ ...assignedSr, adminNote: 'Existing' })
        .mockResolvedValueOnce({ ...assignedSr, deletedAt: null });
      mockPrisma.servicePhoto.create.mockResolvedValue({});
      mockPrisma.serviceRequest.update.mockResolvedValue({});

      await service.disputeResponse('sr-1', 'u-staff', 'soc-1', 'Fixed again', ['k1']);

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalled();
    });

    it('assertStaffCanAccessTask rejects unassigned staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 's1', userId: 'u-staff' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        ...assignedSr,
        assignedToIds: ['other-staff'],
      });
      await expect(service.getPhotoUploadUrl('sr-1', 'u-staff', 'soc-1', 'BEFORE')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findByResident', () => {
    it('returns resident requests enriched with assigned staff', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'f1', societyId: 'soc-1' });
      mockPrisma.serviceRequest.findMany.mockResolvedValue([
        { id: 'sr-1', assignedToIds: ['s1'], photos: [] },
      ]);
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', user: { name: 'Bob' } }]);

      const rows = await service.findByResident('u1', 'soc-1');

      expect(rows[0].assignedStaff).toHaveLength(1);
    });
  });

  describe('findBySociety', () => {
    it('filters by managed blocks when provided', async () => {
      mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
      await service.findBySociety('soc-1', undefined, ['A', 'B']);
      expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resident: { flat: { block: { in: ['A', 'B'] } } },
          }),
        }),
      );
    });
  });

  describe('raiseDispute', () => {
    it('reopens completed request and notifies assigned staff', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
        category: 'PLUMBING',
        assignedToIds: ['s1'],
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({
        id: 'sr-1',
        assignedToIds: ['s1'],
        category: 'PLUMBING',
      });

      await service.raiseDispute('sr-1', 'u1', 'soc-1', 'Not fixed');

      expect(mockGateway.emitTaskAssigned).toHaveBeenCalled();
    });
  });

  describe('create with SLA', () => {
    it('applies slaDeadline from society config', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'f1', societyId: 'soc-1' });
      mockPrisma.society.findUnique.mockResolvedValue({
        id: 'soc-1',
        config: { slaConfig: { PLUMBING: 4, DEFAULT: 24 } },
      });
      mockPrisma.serviceRequest.create.mockResolvedValue({
        id: 'sr-1',
        assignedToIds: [],
        photos: [],
      });

      await service.create('u1', 'soc-1', { category: 'PLUMBING', description: 'Leak' } as any);

      expect(mockPrisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slaDeadline: expect.any(Date) }),
        }),
      );
    });
  });

  describe('updateStatus edge cases', () => {
    it('requires reason when rejecting', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
      });
      await expect(
        service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates assignedToIds via legacy assignedToId field', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.ASSIGNED,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1' });

      await service.updateStatus('sr-1', 'soc-1', {
        status: ServiceRequestStatus.ASSIGNED,
        assignedToId: 's2',
      });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ assignedToIds: ['s2'] }),
      });
    });
  });

  describe('assignStaff error paths', () => {
    it('throws when staff not in society', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
      });
      await expect(service.assignStaff('sr-1', 'soc-1', ['missing'])).rejects.toThrow(BadRequestException);
    });

    it('throws when assigning to completed request', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', societyId: 'soc-1', deletedAt: null }]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
      });
      await expect(service.assignStaff('sr-1', 'soc-1', ['s1'])).rejects.toThrow(ConflictException);
    });
  });

  describe('autoAssign error paths', () => {
    it('throws when request is not PENDING', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.ASSIGNED,
        category: 'X',
      });
      await expect(service.autoAssign('sr-1', 'soc-1')).rejects.toThrow(BadRequestException);
    });

    it('throws ALL_STAFF_OVERLOADED when every staff is at capacity', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        category: 'X',
        description: 'Y',
      });
      mockPrisma.staffMember.findMany.mockResolvedValue([
        { id: 's1', societyId: 'soc-1', deletedAt: null, categories: [] },
      ]);
      mockPrisma.serviceRequest.count.mockResolvedValue(3);

      await expect(service.autoAssign('sr-1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ALL_STAFF_OVERLOADED' }),
      });
    });
  });

  describe('findOne edge cases', () => {
    it('throws when request is soft-deleted', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: new Date(),
        societyId: 'soc-1',
      });
      await expect(service.findOne('sr-1')).rejects.toThrow(NotFoundException);
    });

    it('enriches assigned staff when assignedToIds present', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        societyId: 'soc-1',
        assignedToIds: ['s1'],
        resident: {},
        photos: [],
      });
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', user: { name: 'Raj' } }]);

      const result = await service.findOne('sr-1');

      expect(result.assignedStaff).toHaveLength(1);
    });
  });

  describe('resident flows', () => {
    it('create throws RESIDENT_SOCIETY_MISMATCH', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'f1', societyId: 'other' });
      await expect(
        service.create('u1', 'soc-1', { category: 'X', description: 'Y' } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RESIDENT_SOCIETY_MISMATCH' }) });
    });

    it('findByResident throws on society mismatch', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'f1', societyId: 'other' });
      await expect(service.findByResident('u1', 'soc-1')).rejects.toThrow(ForbiddenException);
    });

    it('findByStaff throws STAFF_SOCIETY_MISMATCH', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 's1', societyId: 'other' });
      await expect(service.findByStaff('u-staff', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'STAFF_SOCIETY_MISMATCH' }),
      });
    });

    it('confirmCompletion closes completed request', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1', status: 'CLOSED' });
      await service.confirmCompletion('sr-1', 'u1', 'soc-1');
      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ status: ServiceRequestStatus.CLOSED }),
      });
    });

    it('raiseDispute rejects when not completed', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
      });
      await expect(service.raiseDispute('sr-1', 'u1', 'soc-1', 'bad')).rejects.toThrow(BadRequestException);
    });
  });

  describe('staff access guards', () => {
    it('rejects photo upload when task has no assignees', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 's1', userId: 'u-staff' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        assignedToIds: [],
        status: ServiceRequestStatus.ASSIGNED,
      });
      await expect(service.getPhotoUploadUrl('sr-1', 'u-staff', 'soc-1', 'BEFORE')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'NOT_ASSIGNED_STAFF' }),
      });
    });
  });

  describe('updateStatus transition details', () => {
    it('sets rejectedReason and acceptedAt on transitions', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        acceptedAt: null,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1' });

      await service.updateStatus('sr-1', 'soc-1', {
        status: ServiceRequestStatus.REJECTED,
        reason: 'Invalid request',
      });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ rejectedReason: 'Invalid request' }),
      });
    });

    it('clears resolvedAt when moving away from COMPLETED', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.COMPLETED,
        acceptedAt: new Date(),
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1' });

      await service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.IN_PROGRESS });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ resolvedAt: null, rejectedReason: null, status: ServiceRequestStatus.IN_PROGRESS }),
      });
    });

    it('sets acceptedAt when moving to IN_PROGRESS from ASSIGNED', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.ASSIGNED,
        acceptedAt: null,
      });
      mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'sr-1' });

      await service.updateStatus('sr-1', 'soc-1', { status: ServiceRequestStatus.IN_PROGRESS });

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: expect.objectContaining({ acceptedAt: expect.any(Date) }),
      });
    });
  });

  describe('rate', () => {
    it('throws RESIDENT_SOCIETY_MISMATCH when flat society differs', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1', flatId: 'f1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        societyId: 'soc-1',
        residentId: 'res-1',
        status: ServiceRequestStatus.COMPLETED,
        assignedToIds: [],
        resident: {},
        photos: [],
      });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'f1', societyId: 'other' });

      await expect(service.rate('sr-1', 'u1', 'soc-1', { rating: 5 } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RESIDENT_SOCIETY_MISMATCH' }),
      });
    });
  });

  describe('confirmCompletion errors', () => {
    it('throws NOT_COMPLETED when status is not COMPLETED', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'u1' });
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        residentId: 'res-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.IN_PROGRESS,
      });

      await expect(service.confirmCompletion('sr-1', 'u1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'NOT_COMPLETED' }),
      });
    });
  });

  describe('assignStaffWithSchedule without schedule', () => {
    it('returns assign result when no scheduledTime', async () => {
      mockPrisma.staffMember.findMany.mockResolvedValue([{ id: 's1', societyId: 'soc-1', deletedAt: null }]);
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        societyId: 'soc-1',
        status: ServiceRequestStatus.PENDING,
        category: 'X',
        description: 'Y',
      });
      mockPrisma.serviceRequest.count.mockResolvedValue(0);
      mockPrisma.serviceRequest.update.mockResolvedValue({
        id: 'sr-1',
        assignedToIds: ['s1'],
        category: 'X',
        description: 'Y',
      });

      const result = await service.assignStaffWithSchedule('sr-1', 'soc-1', ['s1']);
      expect(result).toMatchObject({ assignedToIds: ['s1'] });
    });
  });
});
