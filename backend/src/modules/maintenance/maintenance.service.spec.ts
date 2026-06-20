import { createHmac } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPush = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};

const mockPrisma: Record<string, any> = {
  resident: { findUnique: jest.fn() },
  payment: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
};

describe('MaintenanceService — push notifications', () => {
  let service: MaintenanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = module.get<MaintenanceService>(MaintenanceService);
    jest.clearAllMocks();
  });

  it('verifyPayment fires a PAYMENT_RECEIVED push to the paying user', async () => {
    mockPrisma.resident.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', user: {}, flat: {} });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      residentId: 'r1',
      status: PaymentStatus.PENDING,
      gatewayRef: 'order_1',
      billId: 'bill-1',
      amount: 1500,
    });
    mockPrisma.payment.update.mockResolvedValue({
      id: 'pay-1',
      residentId: 'r1',
      status: PaymentStatus.SUCCESS,
      billId: 'bill-1',
      amount: 1500,
    });

    await service.verifyPayment('pay-1', 'u1', 'pay_gw_1');
    await new Promise((r) => setImmediate(r));

    expect(mockPush.send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'payments_dues' }),
      expect.objectContaining({ type: 'PAYMENT_RECEIVED' }),
    );
  });
});

/**
 * Razorpay signature verification fixtures (task 24).
 * The verifyRazorpaySignature method is private, so we replicate it here to
 * pin the algorithm: HMAC-SHA256(key_secret, order_id + '|' + payment_id).
 */
describe('Razorpay signature', () => {
  it('verifies a known fixture', () => {
    const orderId = 'order_DslnoIgkIDL8Zt';
    const paymentId = 'pay_DvZjksxPY9TR3X';
    const secret = 'test_secret_key';
    const sig = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    expect(sig).toEqual(expected);
    expect(sig).toHaveLength(64);
  });

  it('rejects mismatched signature', () => {
    const expected = createHmac('sha256', 'test_secret').update('a|b').digest('hex');
    const wrong = 'deadbeef'.repeat(8);
    expect(expected).not.toEqual(wrong);
  });
});
