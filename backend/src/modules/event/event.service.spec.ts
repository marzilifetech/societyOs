import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPush = {
  send: jest.fn(),
  sendToSociety: jest.fn(),
};
const mockPrisma: Record<string, any> = {
  event: { create: jest.fn() },
};

describe('EventService notifications', () => {
  let service: EventService;

  beforeEach(async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = m.get(EventService);
    jest.clearAllMocks();
    mockPush.send.mockResolvedValue({ ok: true });
    mockPush.sendToSociety.mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 });
  });

  it('create sends EVENT_CREATED push to society residents', async () => {
    mockPrisma.event.create.mockResolvedValue({
      id: 'e1',
      title: 'Diwali Bash',
      description: 'Fun',
      venue: 'Hall',
      date: new Date(),
    });

    await service.create('s1', { title: 'Diwali Bash', date: '2026-11-01' });
    await new Promise((r) => setImmediate(r));

    expect(mockPush.sendToSociety).toHaveBeenCalledWith(
      's1',
      'RESIDENT',
      expect.objectContaining({ category: 'community' }),
      expect.objectContaining({ type: 'EVENT_CREATED' }),
    );
  });
});
