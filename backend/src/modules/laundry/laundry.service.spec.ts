import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LaundryService } from './laundry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { PushService } from '../../common/notification/push.service';
import { LaundryBookingStatus } from '@prisma/client';

/**
 * Smoke + tenancy tests. The cross-tenant guards are critical — admin/staff
 * endpoints take an `:id` from the URL with no implicit society filter, so
 * `requireOwnedById` must reject foreign-society reads.
 */
describe('LaundryService — cross-tenant guard', () => {
  let service: LaundryService;
  const mockPrisma = {
    laundryBooking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    resident: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;

  const mockS3 = {
    getPresignedUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'u', key: 'k', publicUrl: 'p' }),
  } as any;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LaundryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: PushService, useValue: { send: jest.fn().mockResolvedValue({ ok: true }), sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }) } },
      ],
    }).compile();
    service = moduleRef.get(LaundryService);
    jest.clearAllMocks();
  });

  describe('getBookingById', () => {
    it('returns the booking when society matches', async () => {
      const booking = { id: 'b1', societyId: 'soc-1', status: LaundryBookingStatus.SCHEDULED };
      mockPrisma.laundryBooking.findUnique.mockResolvedValue(booking);
      const result = await service.getBookingById('b1', 'soc-1');
      expect(result).toBe(booking);
    });

    it('throws ForbiddenException with CROSS_TENANT_ACCESS when society differs', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({
        id: 'b1',
        societyId: 'soc-other',
      });
      await expect(service.getBookingById('b1', 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CROSS_TENANT_ACCESS' }),
      });
      await expect(service.getBookingById('b1', 'soc-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when booking missing', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue(null);
      await expect(service.getBookingById('missing', 'soc-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPickedUp', () => {
    it('updates when society matches', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({ id: 'b1', societyId: 'soc-1' });
      mockPrisma.laundryBooking.update.mockResolvedValue({ id: 'b1', status: 'PICKED_UP' });
      const result = await service.markPickedUp('b1', 'soc-1');
      expect(result).toMatchObject({ status: 'PICKED_UP' });
    });

    it('blocks cross-tenant pickup', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({ id: 'b1', societyId: 'soc-other' });
      await expect(service.markPickedUp('b1', 'soc-1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.laundryBooking.update).not.toHaveBeenCalled();
    });
  });

  describe('getPhotoUploadUrl', () => {
    it('refuses to mint URL for foreign-society booking', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({ id: 'b1', societyId: 'soc-other' });
      await expect(service.getPhotoUploadUrl('b1', 'soc-1')).rejects.toThrow(ForbiddenException);
      expect(mockS3.getPresignedUploadUrl).not.toHaveBeenCalled();
    });

    it('mints URL when society matches', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({ id: 'b1', societyId: 'soc-1' });
      const result = await service.getPhotoUploadUrl('b1', 'soc-1', 'image/jpeg');
      expect(result).toMatchObject({ key: 'k' });
      expect(mockS3.getPresignedUploadUrl).toHaveBeenCalledWith('laundry/b1', 'image/jpeg');
    });
  });

  describe('updateStatus', () => {
    it('blocks cross-tenant status update', async () => {
      mockPrisma.laundryBooking.findUnique.mockResolvedValue({ id: 'b1', societyId: 'soc-other' });
      await expect(
        service.updateStatus('b1', 'soc-1', LaundryBookingStatus.DELIVERED),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
