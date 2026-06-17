import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommunityPostStatus, UserRole } from '@prisma/client';
import { CommunityService } from './community.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';

const mockPrisma: Record<string, any> = {
  communityPost: { findUnique: jest.fn(), update: jest.fn() },
  resident: { findUnique: jest.fn() },
};

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: { send: jest.fn().mockResolvedValue({ ok: true }), sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }) } },
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
