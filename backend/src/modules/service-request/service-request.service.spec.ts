import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceRequestStatus } from '@prisma/client';
import { S3Service } from '../../common/storage/s3.service';
import { ServiceRequestGateway } from './service-request.gateway';

const mockPrisma = {
  resident: { findUnique: jest.fn() },
  flat: { findUnique: jest.fn() },
  society: { findUnique: jest.fn().mockResolvedValue({ id: 'soc-1', config: {} }) },
  staffMember: { findUnique: jest.fn(), findFirst: jest.fn() },
  serviceRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ServiceRequestService>(ServiceRequestService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) => cb(mockPrisma));
  });

  describe('create', () => {
    it('creates a service request with residentId and societyId', async () => {
      const dto = { category: 'PLUMBING', description: 'Leaking pipe' };
      const created = { id: 'sr-1', residentId: 'res-1', societyId: 'soc-1', ...dto };
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1', flatId: 'flat-1' });
      mockPrisma.flat.findUnique.mockResolvedValue({ id: 'flat-1', societyId: 'soc-1' });
      mockPrisma.serviceRequest.create.mockResolvedValue(created);

      const result = await service.create('user-1', 'soc-1', dto as any);

      expect(result).toEqual(created);
      expect(mockPrisma.serviceRequest.create).toHaveBeenCalledWith({
        data: { residentId: 'res-1', societyId: 'soc-1', ...dto },
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
        resident: { include: { user: true, flat: true } },
        assignedTo: null,
        photos: [],
      };
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(sr);

      const result = await service.findOne('sr-1');

      expect(result).toEqual(sr);
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
});
