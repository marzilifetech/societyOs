/**
 * Integration: community moderation. Admins (who have no resident record)
 * must be able to delete and pin posts; residents may only delete their own.
 */
import { ForbiddenException } from '@nestjs/common';
import { CommunityPostStatus, UserRole } from '@prisma/client';
import { CommunityService } from '../src/modules/community/community.service';
import { makePrismaMock } from './helpers/prisma-mock';

describe('Community moderation', () => {
  const prisma = makePrismaMock(['communityPost', 'resident']);
  const service = new CommunityService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('admin deletes any post without needing a resident profile', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'someone-else' });
    prisma.communityPost.update.mockResolvedValue({ id: 'p1', status: CommunityPostStatus.REMOVED });

    await service.deletePost('p1', 'admin-user', UserRole.ADMIN);

    expect(prisma.resident.findUnique).not.toHaveBeenCalled();
    expect(prisma.communityPost.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: CommunityPostStatus.REMOVED },
    });
  });

  it('non-owner resident cannot delete another resident’s post', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', residentId: 'r-owner' });
    prisma.resident.findUnique.mockResolvedValue({ id: 'r-intruder', user: {}, flat: {} });

    await expect(service.deletePost('p1', 'intruder', UserRole.RESIDENT)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('pin is scoped to the society', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p1', societyId: 'soc-other' });
    await expect(service.pinPost('p1', 'soc-1', true)).rejects.toThrow(ForbiddenException);

    prisma.communityPost.findUnique.mockResolvedValue({ id: 'p2', societyId: 'soc-1' });
    prisma.communityPost.update.mockResolvedValue({ id: 'p2', isPinned: true });
    await service.pinPost('p2', 'soc-1', true);
    expect(prisma.communityPost.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { isPinned: true },
    });
  });
});
