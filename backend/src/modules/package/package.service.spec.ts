import { Test, TestingModule } from '@nestjs/testing';
import { PackageService } from './package.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { PackageGateway } from './package.gateway';

const mockPush = {
  send: jest.fn(),
  sendToSociety: jest.fn(),
};
const mockGateway = { emitPackageArrived: jest.fn() };
const mockPrisma: Record<string, any> = {
  resident: { findUnique: jest.fn() },
  package: { create: jest.fn() },
};

describe('PackageService notifications', () => {
  let service: PackageService;

  beforeEach(async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        PackageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
        { provide: PackageGateway, useValue: mockGateway },
      ],
    }).compile();
    service = m.get(PackageService);
    jest.clearAllMocks();
    mockPush.send.mockResolvedValue({ ok: true });
    mockPush.sendToSociety.mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 });
  });

  it('logArrival sends PACKAGE_ARRIVED push to recipient resident', async () => {
    mockPrisma.resident.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      flat: { societyId: 's1' },
    });
    mockPrisma.package.create.mockResolvedValue({
      id: 'p1',
      residentId: 'r1',
      courierName: 'BlueDart',
      trackingNumber: null,
      arrivedAt: new Date(),
    });

    await service.logArrival('guard1', 's1', {
      residentId: 'r1',
      courierName: 'BlueDart',
      photoUrl: 'http://x/y.jpg',
    });
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'deliveries' }),
      expect.objectContaining({ type: 'PACKAGE_ARRIVED' }),
    );
  });
});
