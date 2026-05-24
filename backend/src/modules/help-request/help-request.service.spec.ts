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

describe('HelpRequestService assignedToIds flows', () => {
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

  it('getMyHelpRequests filters by assignedToIds has staffId', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    await service.getMyHelpRequests('u-staff');
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedToIds: { has: 'staff-1' } }),
      }),
    );
  });

  it('acceptHelpRequest sets assignedToIds array', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: 'hr-1' });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'hr-1', assignedToIds: ['staff-1'] });
    await service.acceptHelpRequest('u-staff', 'hr-1');
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'hr-1' },
      data: expect.objectContaining({ assignedToIds: ['staff-1'] }),
    });
  });

  it('getMyHelpRequestById throws when staff not in assignedToIds', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'hr-1',
      assignedToIds: ['other'],
    });
    await expect(service.getMyHelpRequestById('u-staff', 'hr-1')).rejects.toThrow(NotFoundException);
  });

  it('updateHelpRequestStatus rejects wrong assignee', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'hr-1',
      assignedToIds: ['other'],
    });
    await expect(
      service.updateHelpRequestStatus('u-staff', 'hr-1', 'IN_PROGRESS'),
    ).rejects.toThrow(NotFoundException);
  });

  it('completeHelpRequest emits realtime event', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: 'hr-1', residentId: 'res-1' });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'hr-1', status: 'COMPLETED' });
    await service.completeHelpRequest('u-staff', 'hr-1');
    expect(mockRealtime.emit).toHaveBeenCalledWith(
      'resident:res-1',
      'help:completed',
      expect.objectContaining({ requestId: 'hr-1' }),
    );
  });

  it('completeHelpRequest throws when request missing', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    await expect(service.completeHelpRequest('u-staff', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('acceptHelpRequest throws when request missing', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    await expect(service.acceptHelpRequest('u-staff', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('updateHelpRequestStatus allows update when no assignees yet', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'hr-1',
      assignedToIds: [],
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'hr-1', status: 'IN_PROGRESS' });

    await service.updateHelpRequestStatus('u-staff', 'hr-1', 'IN_PROGRESS');

    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'hr-1' },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('getHelpRequestPhotoUploadUrl delegates to S3', async () => {
    const result = await service.getHelpRequestPhotoUploadUrl('hr-1', 'image/jpeg');
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
      mockPrisma.helpRequest.findUnique.mockResolvedValue({ id: 'h1', residentId: 'res-1' });
      const req = await service.getHelpRequestById('h1', 'u-res');
      expect(req).toMatchObject({ id: 'h1' });
    });

    it('getHelpRequestById throws when not owner', async () => {
      mockPrisma.helpRequest.findUnique.mockResolvedValue({ id: 'h1', residentId: 'other' });
      await expect(service.getHelpRequestById('h1', 'u-res')).rejects.toThrow(NotFoundException);
    });
  });

  it('getMyHelpRequestById returns request when staff is assignee', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'hr-1',
      assignedToIds: ['staff-1'],
    });
    const req = await service.getMyHelpRequestById('u-staff', 'hr-1');
    expect(req).toMatchObject({ id: 'hr-1' });
  });

  it('updateHelpRequestStatus sets resolvedAt on COMPLETED', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'hr-1',
      assignedToIds: ['staff-1'],
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: 'hr-1', status: 'COMPLETED' });

    await service.updateHelpRequestStatus('u-staff', 'hr-1', 'COMPLETED');

    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'hr-1' },
      data: expect.objectContaining({ status: 'COMPLETED', resolvedAt: expect.any(Date) }),
    });
  });

  it('resolveStaffId throws when staff profile missing', async () => {
    mockPrisma.staffMember.findUnique.mockResolvedValue(null);
    await expect(service.getMyHelpRequests('unknown')).rejects.toThrow(NotFoundException);
  });
});
