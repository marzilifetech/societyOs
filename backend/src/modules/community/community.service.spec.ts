import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommunityPostStatus, UserRole } from '@prisma/client';
import { CommunityService } from './community.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPrisma: Record<string, any> = {
  communityPost: { findUnique: jest.fn(), update: jest.fn() },
  postComment: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  resident: { findUnique: jest.fn() },
};

const mockPush = {
  send: jest.fn().mockResolvedValue({ ok: true }),
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = module.get<CommunityService>(CommunityService);
    jest.clearAllMocks();
  });

  describe('deletePost', () => {
    it('lets an ADMIN remove a post WITHOUT requiring a resident record', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'r-other' });
      mockPrisma.communityPost.update.mockResolvedValue({ id: 'p1', status: CommunityPostStatus.REMOVED });

      await service.deletePost('p1', 'admin-user', UserRole.ADMIN);

      // The bug this guards: admins have no resident row, so resident lookup
      // must never be reached on the admin path.
      expect(mockPrisma.resident.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.communityPost.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: CommunityPostStatus.REMOVED },
      });
    });

    it('lets a SUPER_ADMIN remove a post without a resident record', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'r-other' });
      mockPrisma.communityPost.update.mockResolvedValue({ id: 'p1' });

      await service.deletePost('p1', 'super-user', UserRole.SUPER_ADMIN);

      expect(mockPrisma.resident.findUnique).not.toHaveBeenCalled();
    });

    it('lets the owning resident delete their own post', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'r1' });
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'r1' });
      mockPrisma.communityPost.update.mockResolvedValue({ id: 'p1' });

      await service.deletePost('p1', 'res-user', UserRole.RESIDENT);

      expect(mockPrisma.communityPost.update).toHaveBeenCalled();
    });

    it('forbids a non-owner resident from deleting', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'r-other' });
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'r1' });

      await expect(service.deletePost('p1', 'res-user', UserRole.RESIDENT)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.communityPost.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the post does not exist', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue(null);
      await expect(service.deletePost('missing', 'admin', UserRole.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addComment', () => {
    it('notifies the post owner with a COMMUNITY_COMMENT push', async () => {
      // actor resident (resolved via requireResidentByUserId)
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'r-actor', user: { name: 'Bob' } });
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'p1',
        resident: { id: 'r-owner', userId: 'owner-user' },
      });
      mockPrisma.postComment.create.mockResolvedValue({
        id: 'c1',
        resident: { user: { name: 'Bob' } },
      });

      await service.addComment('p1', 'actor-user', { content: 'hi' } as any);
      await new Promise((r) => setImmediate(r));

      expect(mockPush.send).toHaveBeenCalledWith(
        'owner-user',
        expect.objectContaining({ category: 'community' }),
        expect.objectContaining({ type: 'COMMUNITY_COMMENT' }),
      );
    });

    it('does NOT notify when the commenter is the post owner', async () => {
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'r-owner', user: { name: 'Owner' } });
      mockPrisma.communityPost.findUnique.mockResolvedValue({
        id: 'p1',
        resident: { id: 'r-owner', userId: 'owner-user' },
      });
      mockPrisma.postComment.create.mockResolvedValue({
        id: 'c1',
        resident: { user: { name: 'Owner' } },
      });

      await service.addComment('p1', 'owner-user', { content: 'hi' } as any);
      await new Promise((r) => setImmediate(r));

      expect(mockPush.send).not.toHaveBeenCalled();
    });
  });

  describe('pinPost', () => {
    it('pins a post that belongs to the society', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', societyId: 'soc-1' });
      mockPrisma.communityPost.update.mockResolvedValue({ id: 'p1', isPinned: true });

      await service.pinPost('p1', 'soc-1', true);

      expect(mockPrisma.communityPost.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isPinned: true },
      });
    });

    it('rejects pinning a post from another society', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', societyId: 'soc-other' });

      await expect(service.pinPost('p1', 'soc-1', true)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.communityPost.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the post does not exist', async () => {
      mockPrisma.communityPost.findUnique.mockResolvedValue(null);
      await expect(service.pinPost('missing', 'soc-1', true)).rejects.toThrow(NotFoundException);
    });
  });
});
