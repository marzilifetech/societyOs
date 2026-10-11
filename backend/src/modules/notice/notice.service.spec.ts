import { Test, TestingModule } from '@nestjs/testing';
import { GoneException } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';
import { WhatsAppService } from '../../common/notification/whatsapp.service';

const mockPrisma = {
  notice: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  poll: { findMany: jest.fn(), findUnique: jest.fn() },
  pollVote: { upsert: jest.fn(), findMany: jest.fn() },
  resident: { findUnique: jest.fn() },
  user: { findMany: jest.fn().mockResolvedValue([]) },
};

const mockRealtime = {
  emitToSociety: jest.fn(),
  emitToUser: jest.fn(),
};
const mockPush = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};
const mockWhatsapp = {
  broadcastToSociety: jest.fn().mockResolvedValue({ sent: true }),
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
        { provide: WhatsAppService, useValue: mockWhatsapp },
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
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });
  });

  describe('createNotice', () => {
    it('creates a notice with societyId and sets publishedAt', async () => {
      const dto = { title: 'New Notice', content: 'Content', category: 'GENERAL', isPinned: false };
      const created = { id: 'notice-1', societyId: 'society-1', ...dto };
      mockPrisma.notice.create.mockResolvedValue(created);
      mockPrisma.user.findMany.mockResolvedValue([{ phone: '+919999999999' }]);

      const result = await service.createNotice('society-1', dto);

      expect(result).toEqual(created);
      expect(mockPrisma.notice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societyId: 'society-1',
          title: dto.title,
          publishedAt: expect.any(Date),
        }),
      });
      await new Promise((r) => setImmediate(r));
      expect(mockWhatsapp.broadcastToSociety).toHaveBeenCalled();
    });

    it('fires a NOTICE_PUBLISHED push to society residents for a normal notice', async () => {
      const dto = { title: 'New Notice', content: 'Content', category: 'GENERAL', isPinned: false };
      mockPrisma.notice.create.mockResolvedValue({ id: 'notice-1', societyId: 'society-1', ...dto });
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.createNotice('society-1', dto);
      await new Promise((r) => setImmediate(r));

      expect(mockPush.sendToSociety).toHaveBeenCalledWith(
        'society-1',
        ['RESIDENT', 'ADMIN', 'BUILDING_ADMIN'],
        expect.objectContaining({ category: 'notices' }),
        expect.objectContaining({ type: 'NOTICE_PUBLISHED' }),
      );
    });

    it('does NOT fire the normal notices push for an EMERGENCY notice', async () => {
      const dto = { title: 'Fire', content: 'Evacuate', category: 'EMERGENCY', isPinned: true };
      mockPrisma.notice.create.mockResolvedValue({ id: 'notice-2', societyId: 'society-1', ...dto });
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.createNotice('society-1', dto);
      await new Promise((r) => setImmediate(r));

      expect(mockPush.sendToSociety).not.toHaveBeenCalledWith(
        'society-1',
        'RESIDENT',
        expect.objectContaining({ category: 'notices' }),
        expect.objectContaining({ type: 'NOTICE_PUBLISHED' }),
      );
    });
  });

  describe('getNotices visibility', () => {
    it('hides scheduled-push rows and notices published in the future', async () => {
      mockPrisma.notice.findMany.mockResolvedValue([]);
      await service.getNotices('society-1');

      const { where } = mockPrisma.notice.findMany.mock.calls[0][0];
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { OR: [{ category: null }, { category: { not: 'PUSH_SCHEDULED' } }] },
          { OR: [{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }] },
        ]),
      );
    });
  });

  describe('broadcastEmergency', () => {
    beforeEach(() => {
      mockPrisma.notice.create.mockResolvedValue({ id: 'n-1', publishedAt: new Date() });
    });

    it('sends INFO/WARNING on the urgent-notices channel, not as an SOS', async () => {
      await service.broadcastEmergency('society-1', { title: 'Water', message: 'No water 10-12', severity: 'WARNING' as any });

      expect(mockPush.sendToSociety).toHaveBeenCalledWith(
        'society-1',
        ['RESIDENT', 'ADMIN', 'BUILDING_ADMIN', 'STAFF'],
        expect.objectContaining({ category: 'notices_urgent', critical: false }),
        expect.objectContaining({ type: 'EMERGENCY_BROADCAST', entityId: 'n-1' }),
      );
    });

    it('sends EMERGENCY as critical, to residents, admins and staff', async () => {
      await service.broadcastEmergency('society-1', { title: 'Fire', message: 'Evacuate', severity: 'EMERGENCY' as any });

      expect(mockPush.sendToSociety).toHaveBeenCalledWith(
        'society-1',
        ['RESIDENT', 'ADMIN', 'BUILDING_ADMIN', 'STAFF'],
        expect.objectContaining({ category: 'emergency_sos', critical: true }),
        expect.anything(),
      );
    });
  });

  describe('pinNotice', () => {
    it('sets isPinned=true (idempotent, never toggles) on a same-society notice', async () => {
      mockPrisma.notice.findUnique.mockResolvedValue({
        id: 'notice-1',
        societyId: 'society-1',
        isPinned: false,
      });
      mockPrisma.notice.update.mockResolvedValue({ id: 'notice-1', isPinned: true });

      const result = await service.pinNotice('notice-1', 'society-1');

      expect(result.isPinned).toBe(true);
      expect(mockPrisma.notice.update).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
        data: { isPinned: true },
      });
    });

    it('rejects cross-society pin attempts with ForbiddenException', async () => {
      mockPrisma.notice.findUnique.mockResolvedValue({
        id: 'notice-2',
        societyId: 'other-society',
        isPinned: false,
      });
      await expect(service.pinNotice('notice-2', 'society-1')).rejects.toThrow(/another society/);
      expect(mockPrisma.notice.update).not.toHaveBeenCalled();
    });
  });

  describe('getNotices with onlyPinned', () => {
    it('filters by isPinned=true when onlyPinned is set', async () => {
      mockPrisma.notice.findMany.mockResolvedValue([{ id: 'n1', isPinned: true }]);

      await service.getNotices('society-1', { onlyPinned: true, limit: 1 });

      expect(mockPrisma.notice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ societyId: 'society-1', isPinned: true }),
          take: 1,
        }),
      );
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
