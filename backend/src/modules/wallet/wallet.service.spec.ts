import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPush = {
  send: jest.fn(),
  sendToSociety: jest.fn(),
};
const mockPrisma: Record<string, any> = {
  resident: { findFirst: jest.fn(), update: jest.fn() },
  walletTransaction: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('WalletService notifications', () => {
  let service: WalletService;

  beforeEach(async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = m.get(WalletService);
    jest.clearAllMocks();
    mockPush.send.mockResolvedValue({ ok: true });
    mockPush.sendToSociety.mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 });
  });

  it('topUp sends WALLET_CREDITED push to owner', async () => {
    mockPrisma.resident.findFirst.mockResolvedValue({ id: 'r1', walletBalance: 0 });
    mockPrisma.$transaction.mockResolvedValue([{ id: 'txn1' }, {}]);

    await service.topUp('u1', { amount: 500 });
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'payments_dues' }),
      expect.objectContaining({ type: 'WALLET_CREDITED' }),
    );
  });

  it('deduct sends WALLET_DEBITED push to owner', async () => {
    mockPrisma.resident.findFirst.mockResolvedValue({ id: 'r1', walletBalance: 1000 });
    mockPrisma.$transaction.mockResolvedValue([{ id: 'txn2' }, {}]);

    await service.deduct('u1', { amount: 300, description: 'fee' });
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'payments_dues' }),
      expect.objectContaining({ type: 'WALLET_DEBITED' }),
    );
  });
});
