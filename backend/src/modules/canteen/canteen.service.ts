import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreatePreOrderDto, UpdatePreOrderStatusDto } from './dto/pre-order.dto';

@Injectable()
export class CanteenService {
  private readonly logger = new Logger(CanteenService.name);
  constructor(private prisma: PrismaService, private push: PushService) {}

  /**
   * Menus for a date. Returns an ARRAY — one entry per meal type — which is the
   * shape the resident app expects.
   *
   * `mealType` was accepted as a query parameter but never applied, so the
   * admin screen (which asks for one meal and reads `menu.dishes`) always got
   * the whole day and rendered nothing. Honour the filter here; the response
   * stays an array so existing callers are unaffected.
   */
  async getMenu(societyId: string, date: string, mealType?: string) {
    return this.prisma.canteenMenu.findMany({
      where: {
        societyId,
        date: new Date(date),
        ...(mealType ? { mealType } : {}),
      },
      include: { dishes: { orderBy: { name: 'asc' } } },
      orderBy: { mealType: 'asc' },
    });
  }

  async getDish(id: string) {
    const dish = await this.prisma.canteenDish.findUnique({
      where: { id },
      include: {
        menu: true,
        dishRatings: {
          include: { resident: { include: { user: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!dish) throw new NotFoundException('Dish not found');

    const all = await this.prisma.dishRating.findMany({ where: { dishId: id }, select: { rating: true } });
    const ratingCount = all.length;
    const avgRating = ratingCount === 0 ? 0 : all.reduce((s, r) => s + Number(r.rating), 0) / ratingCount;

    return {
      ...dish,
      price: Number(dish.price),
      avgRating,
      ratingCount,
      reviews: dish.dishRatings.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        comment: r.comment ?? undefined,
        residentName: r.resident?.user?.name ?? 'Resident',
        createdAt: r.createdAt,
      })),
    };
  }

  async rateDish(
    dishId: string,
    userId: string,
    dto: { rating: number; comment?: string; preOrderId?: string },
  ) {
    if (typeof dto.rating !== 'number' || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('rating must be a number between 1 and 5');
    }
    const dish = await this.prisma.canteenDish.findUnique({ where: { id: dishId } });
    if (!dish) throw new NotFoundException('Dish not found');

    const resident = await requireResidentByUserId(this.prisma, userId);

    if (dto.preOrderId) {
      const order = await this.prisma.canteenPreOrder.findUnique({ where: { id: dto.preOrderId } });
      if (!order || order.residentId !== resident.id) {
        throw new NotFoundException('Pre-order not found');
      }
    }

    return this.prisma.dishRating.upsert({
      where: { dishId_residentId: { dishId, residentId: resident.id } },
      create: { dishId, residentId: resident.id, rating: dto.rating, comment: dto.comment },
      update: { rating: dto.rating, comment: dto.comment },
    });
  }

  async getWeekMenu(societyId: string) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return this.prisma.canteenMenu.findMany({
      where: { societyId, date: { gte: today, lte: nextWeek } },
      include: { dishes: { where: { isAvailable: true } } },
      orderBy: { date: 'asc' },
    });
  }

  async upsertMenu(societyId: string, date: string, mealType: string, dishes: any[]) {
    const menu = await this.prisma.canteenMenu.upsert({
      where: { societyId_date_mealType: { societyId, date: new Date(date), mealType } },
      create: { societyId, date: new Date(date), mealType },
      update: {},
    });

    await this.prisma.canteenDish.deleteMany({ where: { menuId: menu.id } });
    await this.prisma.canteenDish.createMany({
      data: dishes.map((d) => ({ ...d, menuId: menu.id })),
    });

    return this.prisma.canteenMenu.findUnique({
      where: { id: menu.id },
      include: { dishes: true },
    });
  }

  async createMenu(societyId: string, dto: { date: string; mealType: string; dishes?: any[] }) {
    const menu = await this.prisma.canteenMenu.create({
      data: { societyId, date: new Date(dto.date), mealType: dto.mealType },
    });

    if (dto.dishes && dto.dishes.length > 0) {
      await this.prisma.canteenDish.createMany({
        data: dto.dishes.map((d) => ({ ...d, menuId: menu.id })),
      });
    }

    return this.prisma.canteenMenu.findUnique({ where: { id: menu.id }, include: { dishes: true } });
  }

  async updateMenu(menuId: string, dto: any) {
    await this.prisma.canteenMenu.findUniqueOrThrow({ where: { id: menuId } });
    return this.prisma.canteenMenu.update({ where: { id: menuId }, data: dto, include: { dishes: true } });
  }

  async deleteMenu(menuId: string) {
    await this.prisma.canteenDish.deleteMany({ where: { menuId } });
    return this.prisma.canteenMenu.delete({ where: { id: menuId } });
  }

  async copyWeekMenus(societyId: string, sourceWeekStart: string, targetWeekStart: string) {
    const srcStart = new Date(sourceWeekStart);
    const srcEnd = new Date(srcStart);
    srcEnd.setDate(srcEnd.getDate() + 7);

    const sourceMenus = await this.prisma.canteenMenu.findMany({
      where: { societyId, date: { gte: srcStart, lt: srcEnd } },
      include: { dishes: true },
    });

    if (sourceMenus.length === 0) {
      return { copied: 0 };
    }

    const tgtStart = new Date(targetWeekStart);
    const offsetMs = tgtStart.getTime() - srcStart.getTime();

    let copied = 0;
    for (const menu of sourceMenus) {
      const targetDate = new Date(menu.date.getTime() + offsetMs);

      const existing = await this.prisma.canteenMenu.findFirst({
        where: { societyId, date: targetDate, mealType: menu.mealType },
      });

      if (existing) continue;

      const newMenu = await this.prisma.canteenMenu.create({
        data: { societyId, date: targetDate, mealType: menu.mealType },
      });

      if (menu.dishes.length > 0) {
        await this.prisma.canteenDish.createMany({
          data: menu.dishes.map(({ name, price, calories, allergens, isVeg, isAvailable }) => ({
            name, price, calories, allergens, isVeg,
            isAvailable: isAvailable ?? true,
            menuId: newMenu.id,
          })),
        });
      }

      copied++;
    }

    return { copied };
  }

  async addDish(menuId: string, dto: { name: string; price: number; calories?: number; allergens?: string[]; isVeg: boolean }) {
    await this.prisma.canteenMenu.findUniqueOrThrow({ where: { id: menuId } });
    return this.prisma.canteenDish.create({ data: { ...dto, menuId } });
  }

  async updateDish(dishId: string, dto: any) {
    return this.prisma.canteenDish.update({ where: { id: dishId }, data: dto });
  }

  async deleteDish(dishId: string) {
    return this.prisma.canteenDish.delete({ where: { id: dishId } });
  }

  // ── Pre-Order ────────────────────────────────────────────────────────────────

  async createPreOrder(userId: string, societyId: string, dto: CreatePreOrderDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    const dishIds = dto.items.map((i) => i.dishId);
    const dishes = await this.prisma.canteenDish.findMany({
      where: { id: { in: dishIds }, isAvailable: true },
    });

    if (dishes.length !== dishIds.length) {
      const foundIds = new Set(dishes.map((d) => d.id));
      const missing = dishIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Dish(es) not found or unavailable: ${missing.join(', ')}`);
    }

    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    const orderItems = dto.items.map((item) => {
      const dish = dishMap.get(item.dishId)!;
      return { dishId: dish.id, name: dish.name, quantity: item.quantity, unitPrice: dish.price };
    });

    const totalAmount = orderItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);

    return this.prisma.canteenPreOrder.create({
      data: {
        residentId: resident.id,
        societyId,
        items: orderItems as any,
        totalAmount,
        pickupAt: new Date(dto.pickupAt),
        status: 'PENDING',
        notes: dto.notes,
      },
    });
  }

  async listPreOrders(
    userId: string,
    societyId: string,
    role: string,
    date?: string,
    status?: string,
  ) {
    if (role === 'RESIDENT') {
      const resident = await requireResidentByUserId(this.prisma, userId);
      return this.prisma.canteenPreOrder.findMany({
        where: {
          residentId: resident.id,
          ...(status ? { status: status as any } : {}),
          ...(date
            ? {
                pickupAt: {
                  gte: new Date(date),
                  lt: new Date(new Date(date).getTime() + 86400000),
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.canteenPreOrder.findMany({
      where: {
        societyId,
        ...(status ? { status: status as any } : {}),
        ...(date
          ? {
              pickupAt: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 86400000),
              },
            }
          : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPreOrder(id: string, userId: string, role: string) {
    const order = await this.prisma.canteenPreOrder.findUnique({
      where: { id },
      include: { resident: { include: { user: true, flat: true } } },
    });
    if (!order) throw new NotFoundException('Pre-order not found');

    if (role === 'RESIDENT') {
      const resident = await requireResidentByUserId(this.prisma, userId);
      if (order.residentId !== resident.id) throw new NotFoundException('Pre-order not found');
    }

    return order;
  }

  async cancelPreOrder(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const order = await this.prisma.canteenPreOrder.findUnique({ where: { id } });

    if (!order || order.residentId !== resident.id) throw new NotFoundException('Pre-order not found');
    if (order.status !== 'PENDING') throw new ForbiddenException('Only PENDING orders can be cancelled');

    return this.prisma.canteenPreOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async updatePreOrderStatus(id: string, dto: UpdatePreOrderStatusDto) {
    const order = await this.prisma.canteenPreOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pre-order not found');
    const updated = await this.prisma.canteenPreOrder.update({ where: { id }, data: { status: dto.status as any } });

    const bodyByStatus: Record<string, { type: string; body: string }> = {
      READY: { type: 'CANTEEN_READY', body: 'Your canteen order is ready for pickup.' },
      COLLECTED: { type: 'CANTEEN_COLLECTED', body: 'Your canteen order has been collected.' },
    };
    const mapped = bodyByStatus[String(dto.status)];
    if (mapped) {
      void this.prisma.resident
        .findUnique({ where: { id: order.residentId }, select: { userId: true } })
        .then((resident) => {
          const userId = resident?.userId;
          if (!userId) return;
          return this.push.send(
            userId,
            { title: 'Canteen update', body: mapped.body, category: 'daily_help', collapseKey: `canteen:${id}` },
            { type: mapped.type, entityId: id, preOrderId: id, status: String(dto.status) },
          );
        })
        .catch((e) => this.logger.warn(`canteen push failed id=${id}: ${(e as Error).message}`));
    }

    return updated;
  }

  async listAdminDishRatings(
    societyId: string,
    filters: { dishId?: string; from?: string; to?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      dish: { menu: { societyId } },
      ...(filters.dishId ? { dishId: filters.dishId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total, all] = await Promise.all([
      this.prisma.dishRating.findMany({
        where,
        include: {
          dish: { select: { id: true, name: true } },
          resident: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dishRating.count({ where }),
      this.prisma.dishRating.findMany({ where, select: { rating: true } }),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of all) {
      const v = Math.round(Number(r.rating)) as 1 | 2 | 3 | 4 | 5;
      if (v >= 1 && v <= 5) distribution[v]++;
      sum += Number(r.rating);
    }
    const avg = all.length === 0 ? 0 : sum / all.length;

    return {
      items: items.map((r) => ({
        id: r.id,
        dishId: r.dishId,
        dishName: r.dish?.name ?? null,
        rating: Number(r.rating),
        comment: r.comment ?? null,
        residentName: r.resident?.user?.name ?? 'Resident',
        createdAt: r.createdAt,
      })),
      total,
      avg,
      distribution,
    };
  }

  async listAdminDishReviews(
    dishId: string,
    societyId: string,
    page = 1,
    limit = 20,
  ) {
    const dish = await this.prisma.canteenDish.findFirst({
      where: { id: dishId, menu: { societyId } },
    });
    if (!dish) throw new NotFoundException('Dish not found');

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total, all] = await Promise.all([
      this.prisma.dishRating.findMany({
        where: { dishId },
        include: { resident: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.dishRating.count({ where: { dishId } }),
      this.prisma.dishRating.findMany({ where: { dishId }, select: { rating: true } }),
    ]);

    const avg = all.length === 0 ? 0 : all.reduce((s, r) => s + Number(r.rating), 0) / all.length;

    return {
      items: items.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        comment: r.comment ?? null,
        residentName: r.resident?.user?.name ?? 'Resident',
        createdAt: r.createdAt,
      })),
      total,
      avg,
    };
  }

  async getMenuAnalytics(societyId: string) {
    const ratings = await this.prisma.dishRating.groupBy({
      by: ['dishId'],
      _avg: { rating: true },
      _count: { _all: true },
    });

    const dishIds = ratings.map((r) => r.dishId);

    const dishes = await this.prisma.canteenDish.findMany({
      where: {
        id: { in: dishIds },
        menu: { societyId },
      },
      select: { id: true, name: true },
    });

    const societyDishIds = new Set(dishes.map((d) => d.id));
    const dishMap = new Map(dishes.map((d) => [d.id, d.name]));

    const validRatings = ratings
      .filter((r) => societyDishIds.has(r.dishId) && r._avg.rating !== null)
      .map((r) => ({
        dishId: r.dishId,
        name: dishMap.get(r.dishId),
        averageRating: Number(r._avg.rating),
        totalRatings: r._count._all,
      }))
      .sort((a, b) => b.averageRating - a.averageRating);

    return {
      topDishes: validRatings.slice(0, 5),
      bottomDishes: validRatings.slice(-5).reverse(),
      message: validRatings.length > 0 ? 'Analytics retrieved successfully' : 'No ratings available yet',
    };
  }
}
