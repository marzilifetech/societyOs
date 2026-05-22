import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

const mockPrisma = {
  staffMember: { findUnique: jest.fn() },
  leaveRequest: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
};

describe('StaffService', () => {
  let service: StaffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: {} },
        { provide: RealtimeGateway, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    jest.clearAllMocks();

    mockPrisma.staffMember.findUnique.mockResolvedValue({
      id: 'staff-db-1',
      userId: 'user-1',
    });
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
  });

  describe('requestLeave', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects leave starting before today', async () => {
      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-14',
          endDate: '2026-06-16',
          reason: 'trip',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAST_DATE' }),
      });
      expect(mockPrisma.leaveRequest.findFirst).not.toHaveBeenCalled();
    });

    it('throws Conflict LEAVE_OVERLAP when another pending request overlaps dates', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'existing-leave',
        staffId: 'staff-db-1',
        status: 'PENDING',
      });

      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-18',
          endDate: '2026-06-22',
          reason: 'break',
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-18',
          endDate: '2026-06-22',
          reason: 'break',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LEAVE_OVERLAP', conflictingId: 'existing-leave' }),
      });
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });
  });
});
