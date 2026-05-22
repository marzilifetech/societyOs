import { Test, TestingModule } from '@nestjs/testing';
import { GoneException } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';

const mockPrisma = {
  notice: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  poll: { findMany: jest.fn(), findUnique: jest.fn() },
  pollVote: { upsert: jest.fn(), findMany: jest.fn() },
  resident: { findUnique: jest.fn() },
};

const mockRealtime = {
  emitToSociety: jest.fn(),
  emitToUser: jest.fn(),
};
const mockPush = {
  sendToUser: jest.fn(),
  sendToSociety: jest.fn(),
};

describe('NoticeService', () => {
  let service: NoticeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeGateway, useValue: mockRealtime },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();

    service = module.get<NoticeService>(NoticeService);
    jest.clearAllMocks();
  });

  describe('getNotices', () => {
    it('filters by societyId and excludes expired notices', async () => {
      const notices = [{ id: '1', title: 'Test', isPinned: false }];
      mockPrisma.notice.findMany.mockResolvedValue(notices);

      const result = await service.getNotices('society-1');

      expect(result).toEqual(notices);
      expect(mockPrisma.notice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ societyId: 'society-1' }),
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        }),
      );
    });
  });

  describe('createNotice', () => {
    it('creates a notice with societyId and sets publishedAt', async () => {
      const dto = { title: 'New Notice', content: 'Content', category: 'GENERAL', isPinned: false };
      const created = { id: 'notice-1', societyId: 'society-1', ...dto };
      mockPrisma.notice.create.mockResolvedValue(created);

      const result = await service.createNotice('society-1', dto);

      expect(result).toEqual(created);
      expect(mockPrisma.notice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societyId: 'society-1',
          title: dto.title,
          publishedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('vote', () => {
    it('throws GoneException (410) POLL_CLOSED when deadline has passed', async () => {
      jest.useFakeTimers({ now: new Date('2026-03-10T14:00:00.000Z') });
      mockPrisma.resident.findUnique.mockResolvedValue({
        id: 'res-9',
        user: { societyId: 'soc-1', name: '' },
        flat: { societyId: 'soc-1' },
      });
      mockPrisma.poll.findUnique.mockResolvedValue({
        id: 'poll-closed',
        societyId: 'soc-1',
        deadline: new Date('2026-03-10T13:59:59.000Z'),
        options: ['A', 'B'],
      });

      await expect(service.vote('poll-closed', 'user-z', 'soc-1', [0])).rejects.toThrow(GoneException);
      await expect(service.vote('poll-closed', 'user-z', 'soc-1', [0])).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'POLL_CLOSED',
          message: expect.stringContaining('closed'),
        }),
      });
      expect(mockPrisma.pollVote.upsert).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
