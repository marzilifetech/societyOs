import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';
import { CreateHousekeepingDto } from './dto/create-housekeeping.dto';
import { RateHousekeepingDto } from './dto/rate-housekeeping.dto';
import { UpdateHousekeepingStatusDto } from './dto/update-housekeeping-status.dto';

@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);
  constructor(private prisma: PrismaService, private s3: S3Service) {}

  async getPhotoUploadUrl(id: string, societyId: string, phase?: string, contentType?: string) {
    // Cross-tenant guard: only mint upload URLs for requests in the caller's society.
    await requireOwnedById(
      () => this.prisma.housekeepingRequest.findUnique({ where: { id } }),
      societyId,
      'Housekeeping request',
    );
    const phasePart = phase ? `/${phase.toLowerCase()}` : '';
    return this.s3.getPresignedUploadUrl(`housekeeping/${id}${phasePart}`, contentType);
  }

  async create(userId: string, societyId: string, dto: CreateHousekeepingDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.housekeepingRequest.create({
      data: {
        residentId: resident.id,
        societyId,
        type: dto.type as any,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        status: 'PENDING',
      },
    });
  }

  async findForResident(userId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { residentId: resident.id };
    const [data, total] = await Promise.all([
      this.prisma.housekeepingRequest.findMany({
        where,
        select: {
          id: true, type: true, scheduledAt: true, status: true,
          notes: true, rating: true, review: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.housekeepingRequest.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findForAdmin(societyId: string, status?: string, date?: string, page = 1, limit = 20) {
    const where: any = { societyId };
    if (status) where.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.housekeepingRequest.findMany({
        where,
        select: {
          id: true, type: true, scheduledAt: true, status: true,
          notes: true, rating: true, createdAt: true,
          resident: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
              flat: { select: { id: true, number: true, floor: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.housekeepingRequest.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const request = await this.prisma.housekeepingRequest.findUnique({
      where: { id },
      include: { resident: { include: { user: true, flat: true } } },
    });
    if (!request || request.residentId !== resident.id) {
      throw new NotFoundException('Housekeeping request not found');
    }
    return request;
  }

  async findOneAsAdmin(id: string, societyId: string) {
    return requireOwnedById(
      () =>
        this.prisma.housekeepingRequest.findUnique({
          where: { id },
          include: { resident: { include: { user: true, flat: true } } },
        }),
      societyId,
      'Housekeeping request',
    );
  }

  async cancel(id: string, userId: string) {
    const request = await this.findOne(id, userId);
    if (!['PENDING', 'CONFIRMED'].includes(request.status)) {
      throw new BadRequestException('Only PENDING or CONFIRMED requests can be cancelled');
    }
    return this.prisma.housekeepingRequest.update({
      where: { id },
      data: { status: 'CANCELLED' as any },
    });
  }

  async rate(id: string, userId: string, dto: RateHousekeepingDto) {
    const request = await this.findOne(id, userId);
    if (request.status !== 'COMPLETED') {
      throw new ForbiddenException('You can only rate completed housekeeping requests');
    }
    return this.prisma.housekeepingRequest.update({
      where: { id },
      data: { rating: dto.rating, review: dto.review },
    });
  }

  async updateStatus(id: string, societyId: string, dto: UpdateHousekeepingStatusDto) {
    const request = await this.findOneAsAdmin(id, societyId);
    return this.prisma.housekeepingRequest.update({
      where: { id: request.id },
      data: { status: dto.status as any },
    });
  }
}
