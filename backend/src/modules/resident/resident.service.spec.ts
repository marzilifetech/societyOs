import { Test, TestingModule } from '@nestjs/testing';
import { ResidentService } from './resident.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const mockResident = {
  id: 'res-1',
  userId: 'user-1',
  aadhaar: null,
  panNumber: null,
  idProof: null,
  addressProof: null,
  documentsStatus: 'PENDING',
};

const mockPrisma = {
  resident: {
    findUnique: jest.fn().mockResolvedValue(mockResident),
    findFirst: jest.fn().mockResolvedValue(mockResident),
    update: jest.fn(),
  },
  society: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
};

const mockNotifications = {
  sendToMultiple: jest.fn(),
};

describe('ResidentService.uploadDocuments', () => {
  let service: ResidentService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ResidentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();

    service = moduleRef.get<ResidentService>(ResidentService);
    jest.clearAllMocks();
    mockPrisma.resident.findUnique.mockResolvedValue(mockResident);
    mockPrisma.resident.findFirst.mockResolvedValue(mockResident);
  });

  it('persists Aadhaar number as bytes, PAN number, and URLs, and sets UPLOADED status', async () => {
    mockPrisma.resident.update.mockResolvedValue({ ...mockResident, documentsStatus: 'UPLOADED' });

    await service.uploadDocuments('user-1', {
      aadhaarUrl: 'https://bucket.s3.amazonaws.com/uploads/aadhaar/x.jpg',
      aadhaarNumber: '123412341234',
      panUrl: 'https://bucket.s3.amazonaws.com/uploads/pan/x.jpg',
      panNumber: 'ABCDE1234F',
      addressProofUrl: 'https://bucket.s3.amazonaws.com/uploads/address/x.jpg',
    });

    expect(mockPrisma.resident.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: expect.objectContaining({
        aadhaar: expect.any(Buffer),
        aadhaarUrl: 'https://bucket.s3.amazonaws.com/uploads/aadhaar/x.jpg',
        panNumber: 'ABCDE1234F',
        panUrl: 'https://bucket.s3.amazonaws.com/uploads/pan/x.jpg',
        addressProof: 'https://bucket.s3.amazonaws.com/uploads/address/x.jpg',
        documentsStatus: 'UPLOADED',
      }),
    });
    // Aadhaar bytes contain the digit string
    const callArgs = mockPrisma.resident.update.mock.calls[0][0];
    expect((callArgs.data.aadhaar as Buffer).toString('utf8')).toBe('123412341234');
  });
});

describe('ResidentService.getEmergencyContacts', () => {
  let service: ResidentService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ResidentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();

    service = moduleRef.get<ResidentService>(ResidentService);
    jest.clearAllMocks();
  });

  it('returns the society config emergencyContacts array', async () => {
    const contacts = [
      { id: 'ec-medical', label: 'Medical', phone: '+91-108' },
      { id: 'ec-security', label: 'Security', phone: '+91-9000000099' },
    ];
    mockPrisma.society.findUnique.mockResolvedValue({
      id: 'soc-1',
      config: { emergencyContacts: contacts },
    });

    const result = await service.getEmergencyContacts('soc-1');
    expect(result).toEqual({ id: 'soc-1', config: { emergencyContacts: contacts } });
  });

  it('returns empty array when society has no emergencyContacts configured', async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-2', config: {} });

    const result = await service.getEmergencyContacts('soc-2');
    expect(result.config.emergencyContacts).toEqual([]);
  });
});
