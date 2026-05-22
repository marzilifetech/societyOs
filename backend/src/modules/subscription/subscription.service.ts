import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateSubscriptionDto, PauseSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { residentId: resident.id };
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        select: {
          id: true, vendorId: true, items: true, frequency: true,
          startDate: true, isPaused: true, pauseUntil: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.subscription.create({
      data: {
        residentId: resident.id,
        vendorId: dto.vendorId,
        items: (dto.items ?? []) as Prisma.InputJsonValue,
        frequency: dto.frequency,
        startDate: new Date(dto.startDate),
      },
    });
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.residentId !== resident.id) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async pause(id: string, userId: string, dto: PauseSubscriptionDto) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: {
        isPaused: true,
        pauseUntil: dto.pauseUntil ? new Date(dto.pauseUntil) : null,
      },
    });
  }

  async cancel(id: string, userId: string, _dto: CancelSubscriptionDto) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: {
        isPaused: true,
        pauseUntil: null,
      },
    });
  }

  async resume(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: {
        isPaused: false,
        pauseUntil: null,
      },
    });
  }
}
