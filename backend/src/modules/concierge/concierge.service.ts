import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RateConciergeDto } from './dto/concierge.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConciergeService {
  constructor(private prisma: PrismaService) {}

  async createRequest(userId: string, societyId: string, dto: { type: string; description?: string }) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    return this.prisma.conciergeRequest.create({
      data: { societyId, residentId: resident.id, type: dto.type as any, description: dto.description ?? '' },
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

  async cancelRequest(userId: string, id: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    const req = await this.prisma.conciergeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
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

  async updateStatus(id: string, status: string, note?: string) {
    const req = await this.prisma.conciergeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    return this.prisma.conciergeRequest.update({
      where: { id },
      data: { status: status as any, ...(note ? { note } : {}) },
    });
  }

  async getMyRequest(userId: string, id: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    const req = await this.prisma.conciergeRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Request not found');
    return req;
  }

  async rateRequest(userId: string, id: string, dto: RateConciergeDto) {
    const req = await this.getMyRequest(userId, id);
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
