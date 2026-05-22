import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async submitFeedback(userId: string, societyId: string, dto: {
    category?: string;
    message: string;
    isAnonymous?: boolean;
    rating?: number;
  }) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    return this.prisma.feedback.create({
      data: {
        residentId: resident.id,
        societyId,
        category: dto.category as any ?? 'OTHER',
        message: dto.message,
        isAnonymous: dto.isAnonymous ?? false,
        rating: dto.rating,
      },
    });
  }

  async getMyFeedback(userId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) return [];
    return this.prisma.feedback.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAll(societyId: string, status?: string) {
    return this.prisma.feedback.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      include: {
        resident: {
          include: { user: { select: { name: true } }, flat: { select: { block: true, number: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markReviewed(id: string, adminReply?: string) {
    const fb = await this.prisma.feedback.findUnique({ where: { id } });
    if (!fb) throw new NotFoundException('Feedback not found');
    return this.prisma.feedback.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', ...(adminReply ? { adminReply } : {}) },
    });
  }

  async resolve(id: string, adminReply?: string) {
    const fb = await this.prisma.feedback.findUnique({ where: { id } });
    if (!fb) throw new NotFoundException('Feedback not found');
    return this.prisma.feedback.update({
      where: { id },
      data: { status: 'RESOLVED', ...(adminReply ? { adminReply } : {}) },
    });
  }
}
