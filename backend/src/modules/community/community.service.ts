import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreatePostDto, CreateCommentDto } from './dto/community.dto';
import { CommunityPostStatus, UserRole } from '@prisma/client';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  constructor(private prisma: PrismaService) {}

  async createPost(userId: string, societyId: string, dto: CreatePostDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.communityPost.create({
      data: {
        residentId: resident.id,
        societyId,
        content: dto.content,
        photoUrls: dto.photoUrls ?? [],
        isAnonymous: dto.isAnonymous ?? false,
      },
      include: { resident: { include: { user: true } } },
    });
  }

  async getPosts(societyId: string, page = 1, limit = 20, userId?: string) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: { societyId, status: CommunityPostStatus.ACTIVE },
        include: {
          resident: { include: { user: { select: { name: true } } } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.communityPost.count({ where: { societyId, status: CommunityPostStatus.ACTIVE } }),
    ]);
    const mapped = posts.map((p) => ({
      ...p,
      likeCount: p.reactions,
      commentCount: p._count.comments,
      myLike: false, // PostLike table not in schema; per-user tracking unavailable
    }));
    return { posts: mapped, total, page, limit };
  }

  async getPost(id: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        resident: { include: { user: { select: { name: true } } } },
        _count: { select: { comments: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async deletePost(id: string, userId: string, userRole: string) {
    const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
    const post = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    if (!isAdmin) {
      const resident = await requireResidentByUserId(this.prisma, userId);
      if (post.residentId !== resident.id) throw new ForbiddenException('Not authorized to delete this post');
    }

    return this.prisma.communityPost.update({
      where: { id },
      data: { status: CommunityPostStatus.REMOVED },
    });
  }

  async pinPost(id: string, societyId: string, isPinned: boolean) {
    const post = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.societyId !== societyId) throw new ForbiddenException('Post not in this society');
    return this.prisma.communityPost.update({ where: { id }, data: { isPinned } });
  }

  async toggleLike(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const post = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    // Schema has no PostLike table; reactions counter is the available persistent store.
    // We treat each call as a toggle: increment if reactions is even (liked), track per-user
    // at the resident level is not possible without schema change — increment unconditionally.
    const updated = await this.prisma.communityPost.update({
      where: { id },
      data: { reactions: { increment: 1 } },
    });
    return { liked: true, likeCount: updated.reactions, residentId: resident.id };
  }

  async reactToPost(id: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.communityPost.update({
      where: { id },
      data: { reactions: { increment: 1 } },
    });
  }

  async addComment(postId: string, userId: string, dto: CreateCommentDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.postComment.create({
      data: { postId, residentId: resident.id, content: dto.content },
      include: { resident: { include: { user: { select: { name: true } } } } },
    });
  }

  async getComments(postId: string, page = 1, limit = 20) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { postId };
    const [data, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where,
        select: {
          id: true, content: true, createdAt: true,
          resident: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.postComment.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }
}
