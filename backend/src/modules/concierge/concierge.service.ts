import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RateConciergeDto, normaliseConciergeType } from './dto/concierge.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';

@Injectable()
export class ConciergeService {
  private readonly logger = new Logger(ConciergeService.name);
  constructor(private prisma: PrismaService, private push: PushService) {}

  async createRequest(
    userId: string,
    societyId: string,
    dto: { type: string; description?: string; preferredTime?: string },
  ) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');

    const type = normaliseConciergeType(dto.type);
    const label = typeof dto.type === 'string' ? dto.type.trim() : '';
    // Keep the original label when it did not map cleanly, so the desk still
    // knows the resident asked for e.g. "Heavy Lifting" and not just "OTHER".
    const parts = [dto.description?.trim(), type === 'OTHER' && label && label.toUpperCase() !== 'OTHER' ? `Category: ${label}` : '', dto.preferredTime?.trim() ? `Preferred: ${dto.preferredTime.trim()}` : ''].filter(Boolean);

    return this.prisma.conciergeRequest.create({
      data: {
        societyId,
        residentId: resident.id,
        type,
        description: parts.join(' \u2014 ') || label || 'Assistance requested',
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  async getMyRequests(userId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) return [];
    return this.prisma.conciergeRequest.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelRequest(userId: string, id: string, societyId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    const req = await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    if (req.residentId !== resident?.id) throw new ForbiddenException();
    if (req.status !== 'PENDING') throw new ForbiddenException('Cannot cancel non-pending request');
    return this.prisma.conciergeRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async getAll(societyId: string, status?: string) {
    return this.prisma.conciergeRequest.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, societyId: string, status: string, note?: string) {
    await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    const updated = await this.prisma.conciergeRequest.update({
      where: { id },
      data: { status: status as any, ...(note ? { note } : {}) },
      include: { resident: { select: { userId: true } } },
    });

    const type = String(status) === 'COMPLETED' ? 'CONCIERGE_COMPLETED' : 'CONCIERGE_UPDATED';
    const body =
      String(status) === 'COMPLETED'
        ? 'Your concierge request has been completed.'
        : `Your concierge request is now ${String(status).replace(/_/g, ' ').toLowerCase()}.`;
    const userId = updated.resident?.userId;
    if (userId) {
      void this.push
        .send(
          userId,
          { title: 'Concierge update', body, category: 'daily_help', collapseKey: `concierge:${id}` },
          { type, entityId: id, requestId: id, status: String(status) },
        )
        .catch((e) => this.logger.warn(`concierge push failed id=${id}: ${(e as Error).message}`));
    }

    return updated;
  }

  async getMyRequest(userId: string, id: string, societyId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    const req = await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    if (req.residentId !== resident.id) throw new NotFoundException('Request not found');
    return req;
  }

  async rateRequest(userId: string, id: string, societyId: string, dto: RateConciergeDto) {
    const req = await this.getMyRequest(userId, id, societyId);
    if (req.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate completed requests');
    }
    if (req.rating !== null) {
      throw new BadRequestException('Request has already been rated');
    }
    return this.prisma.conciergeRequest.update({
      where: { id },
      data: { rating: dto.rating, ratingText: dto.review ?? null },
    });
  }
}
