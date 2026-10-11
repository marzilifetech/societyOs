import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HelpRequestService } from './help-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

const mockPrisma = {
  resident: { findUnique: jest.fn() },
  helpRequest: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  staffMember: { findUnique: jest.fn() },
  serviceRequest: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const mockS3 = { getPresignedUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'u', key: 'k' }) };
const mockRealtime = { emit: jest.fn() };

describe('HelpRequestService (resident help requests)', () => {
  let service: HelpRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HelpRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: RealtimeGateway, useValue: mockRealtime },
      ],
    }).compile();
    service = module.get(HelpRequestService);
    jest.clearAllMocks();
    mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'staff-1', userId: 'u-staff' });
  });

  it('getHelpRequestPhotoUploadUrl delegates to S3', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: 'hr-1', societyId: 'soc-1' });
    const result = await service.getHelpRequestPhotoUploadUrl('hr-1', 'soc-1', 'image/jpeg');
    expect(result).toMatchObject({ uploadUrl: 'u', key: 'k' });
  });

  describe('resident flows', () => {
    beforeEach(() => {
      mockPrisma.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        userId: 'u-res',
        flat: { societyId: 'soc-1' },
        user: {},
      });
    });

    it('getResidentHelpRequests lists by residentId', async () => {
      mockPrisma.helpRequest.findMany.mockResolvedValue([{ id: 'h1' }]);
      const rows = await service.getResidentHelpRequests('u-res');
      expect(rows).toHaveLength(1);
      expect(mockPrisma.helpRequest.findMany).toHaveBeenCalledWith({
        where: { residentId: 'res-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('createHelpRequest creates OPEN request', async () => {
      mockPrisma.helpRequest.create.mockResolvedValue({ id: 'h-new' });
      const created = await service.createHelpRequest('u-res', 'soc-1', {
        category: 'HELP_PACKAGE',
        description: 'Need help',
        urgency: 'HIGH',
      } as any);
      expect(created).toMatchObject({ id: 'h-new' });
      expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          residentId: 'res-1',
          societyId: 'soc-1',
          status: 'OPEN',
        }),
      });
    });

    it('getHelpRequestById returns owned request', async () => {
      mockPrisma.helpRequest.findUnique.mockResolvedValue({ id: 'h1', societyId: 'soc-1', residentId: 'res-1' });
      const req = await service.getHelpRequestById('h1', 'u-res', 'soc-1');
      expect(req).toMatchObject({ id: 'h1' });
    });

    it('getHelpRequestById throws when not owner', async () => {
      mockPrisma.helpRequest.findUnique.mockResolvedValue({ id: 'h1', societyId: 'soc-1', residentId: 'other' });
      await expect(service.getHelpRequestById('h1', 'u-res', 'soc-1')).rejects.toThrow(NotFoundException);
    });
  });

});
