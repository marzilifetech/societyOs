import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

const mockPrisma = {
  staffMember: { findUnique: jest.fn() },
  staffDocument: { findMany: jest.fn(), create: jest.fn() },
};

describe('StaffService documents', () => {
  let service: StaffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: S3Service,
          useValue: { getPublicUrl: jest.fn((k: string) => `https://cdn/${k}`) },
        },
        { provide: RealtimeGateway, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    jest.clearAllMocks();
    mockPrisma.staffMember.findUnique.mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
  });

  it('getMyDocuments reads from StaffDocument table', async () => {
    mockPrisma.staffDocument.findMany.mockResolvedValue([
      { id: 'd1', documentType: 'AADHAR', fileUrl: 'https://x', uploadedAt: new Date(), verifiedAt: null },
    ]);

    const docs = await service.getMyDocuments('user-1');

    expect(docs).toHaveLength(1);
    expect(docs[0].type).toBe('AADHAR');
    expect(docs[0].status).toBe('UPLOADED');
  });

  it('confirmDocumentUpload persists StaffDocument row', async () => {
    mockPrisma.staffDocument.create.mockResolvedValue({ id: 'doc-new' });

    const result = await service.confirmDocumentUpload('user-1', {
      key: 'staff/staff-1/documents/AADHAR/file.pdf',
      type: 'AADHAAR',
    });

    expect(result.documentId).toBe('doc-new');
    expect(mockPrisma.staffDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentType: 'AADHAR', uploadedBy: 'staff' }),
      }),
    );
  });
});
