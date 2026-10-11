import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toEnumKey } from '../../common/utils/dto-transforms';
import { SubmitFeedbackDto } from './dto/feedback.dto';

/** A FeedbackCategory for a key or app label; other labels file under OTHER and are kept as the topic. */
export function feedbackCategoryFor(input?: string): { category: FeedbackCategory; topic: string | null } {
  if (!input) return { category: FeedbackCategory.OTHER, topic: null };
  const key = String(toEnumKey(input));
  if ((Object.values(FeedbackCategory) as string[]).includes(key)) {
    return { category: key as FeedbackCategory, topic: null };
  }
  return { category: FeedbackCategory.OTHER, topic: input.trim() };
}

/** `subject` (the message's first line) and `submittedAt` are what the app reads. */
function withAppAliases<T extends { message: string; createdAt: Date }>(fb: T) {
  return { ...fb, subject: fb.message.split('\n')[0].slice(0, 150), submittedAt: fb.createdAt };
}

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async submitFeedback(userId: string, societyId: string, dto: SubmitFeedbackDto) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    const { category, topic } = feedbackCategoryFor(dto.category);
    // Feedback has no subject or topic column: both lead the message.
    const heading = [topic && `[${topic}]`, dto.subject?.trim()].filter(Boolean).join(' ');
    const created = await this.prisma.feedback.create({
      data: {
        residentId: resident.id,
        societyId,
        category,
        message: heading ? `${heading}\n\n${dto.message}` : dto.message,
        isAnonymous: dto.isAnonymous ?? false,
        rating: dto.rating,
      },
    });
    return withAppAliases(created);
  }

  async getMyFeedback(userId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) return [];
    const rows = await this.prisma.feedback.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(withAppAliases);
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
