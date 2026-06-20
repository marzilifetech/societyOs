import { Test, TestingModule } from '@nestjs/testing';
import { DocumentRequestService } from './document-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPush = {
  send: jest.fn(),
  sendToSociety: jest.fn(),
};
const mockPrisma: Record<string, any> = {
  documentRequest: { findUnique: jest.fn(), update: jest.fn() },
  resident: { findUnique: jest.fn() },
};

describe('DocumentRequestService notifications', () => {
  let service: DocumentRequestService;

  beforeEach(async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = m.get(DocumentRequestService);
    jest.clearAllMocks();
    mockPush.send.mockResolvedValue({ ok: true });
    mockPush.sendToSociety.mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 });
    mockPrisma.resident.findUnique.mockResolvedValue({ userId: 'u1' });
  });

  it('approve sends DOCUMENT_VERIFIED push to requesting resident', async () => {
    mockPrisma.documentRequest.findUnique.mockResolvedValue({ id: 'd1', residentId: 'r1' });
    mockPrisma.documentRequest.update.mockResolvedValue({ id: 'd1', status: 'DELIVERED' });

    await service.approve('d1');
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'account_auth' }),
      expect.objectContaining({ type: 'DOCUMENT_VERIFIED' }),
    );
  });

  it('reject sends DOCUMENT_REJECTED push to requesting resident', async () => {
    mockPrisma.documentRequest.findUnique.mockResolvedValue({ id: 'd2', residentId: 'r1' });
    mockPrisma.documentRequest.update.mockResolvedValue({ id: 'd2', status: 'REJECTED' });

    await service.reject('d2', 'incomplete');
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'account_auth' }),
      expect.objectContaining({ type: 'DOCUMENT_REJECTED' }),
    );
  });
});
