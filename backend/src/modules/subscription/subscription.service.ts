import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateSubscriptionDto, PauseSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';
import { istDateOf } from '../staff/attendance-time';

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
          startDate: true, isPaused: true, pauseUntil: true, cancelledAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { data: data.map(present), meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const line = dto.type || dto.provider ? [{ type: dto.type ?? null, provider: dto.provider ?? null, quantity: dto.quantity ?? 1 }] : [];
    const created = await this.prisma.subscription.create({
      data: {
        residentId: resident.id,
        vendorId: dto.vendorId,
        items: (dto.items ?? line) as Prisma.InputJsonValue,
        frequency: dto.frequency,
        startDate: dto.startDate ? new Date(dto.startDate) : istDateOf(new Date()),
      },
    });
    return present(created);
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
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { cancelledAt: new Date(), isPaused: false, pauseUntil: null },
    });
    return present(updated);
  }

  async resume(id: string, userId: string) {
    const sub = await this.findOne(id, userId);
    if (sub.cancelledAt) {
      throw new ConflictException({ code: 'SUBSCRIPTION_CANCELLED', message: 'This subscription was cancelled. Start a new one.' });
    }
    return this.prisma.subscription.update({
      where: { id },
      data: {
        isPaused: false,
        pauseUntil: null,
      },
    });
  }
}

type SubscriptionRow = { items: Prisma.JsonValue; isPaused: boolean; cancelledAt: Date | null };

/**
 * Adds what the app shows on a card: `status` (ACTIVE / PAUSED / CANCELLED)
 * and the single line's type, provider and quantity. The list returned only
 * `items` and `isPaused`, so cards read "undefined · Qty undefined", always
 * said Active, and Pause/Resume never appeared.
 */
function present<T extends SubscriptionRow>(sub: T) {
  const first = Array.isArray(sub.items) ? (sub.items[0] as Record<string, unknown> | undefined) : undefined;
  return {
    ...sub,
    status: sub.cancelledAt ? 'CANCELLED' : sub.isPaused ? 'PAUSED' : 'ACTIVE',
    type: (first?.type as string | null | undefined) ?? null,
    provider: (first?.provider as string | null | undefined) ?? (first?.name as string | null | undefined) ?? null,
    quantity: typeof first?.quantity === 'number' ? first.quantity : null,
  };
}
