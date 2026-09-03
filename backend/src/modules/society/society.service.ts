import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSocietyBudgetDto, UpdateSocietyBudgetDto, CreateBylawDto, UpdateBylawDto } from './dto/society.dto';

@Injectable()
export class SocietyService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const all = await this.prisma.society.findMany({
      // Only ACTIVE societies appear in the pre-login directory. `status`
      // guards against SUSPENDED/ARCHIVED societies leaking even if their
      // `showInDirectory` flag is left on. The internal Platform society is
      // kept out by never enabling its `showInDirectory` flag.
      where: { showInDirectory: true, archivedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const seen = new Set<string>();
    return all.filter((s) => {
      if (!uuidRegex.test(s.id) || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }

  async findOne(id: string) {
    const society = await this.prisma.society.findUnique({ where: { id } });
    if (!society) throw new NotFoundException('Society not found');
    return society;
  }

  async getFlats(societyId: string) {
    return this.prisma.flat.findMany({
      where: { societyId },
      orderBy: [{ block: 'asc' }, { floor: 'asc' }, { number: 'asc' }],
      select: { id: true, block: true, floor: true, number: true },
    });
  }

  // ─── Budget ───────────────────────────────────────────────────────────────

  /**
   * Annual budgets are stored with `month = 0`.
   *
   * `SocietyBudget` is keyed `@@unique([societyId, year, month])` and `month` is
   * non-null, so a sentinel is needed for the annual case. 0 is used rather
   * than a nullable column because Postgres treats NULLs as distinct in a
   * unique index — nullable `month` would silently allow two annual budgets for
   * the same year.
   */
  private static readonly ANNUAL_MONTH = 0;

  /** Normalises a stored row into the shape every client reads. */
  private shapeBudget(budget: {
    id: string;
    year: number;
    month: number;
    totalIncome: unknown;
    lineItems: unknown;
    publishedAt: Date;
    createdAt: Date;
  } | null) {
    if (!budget) return null;
    const raw = Array.isArray(budget.lineItems) ? (budget.lineItems as any[]) : [];
    const breakdown = raw.map((item) => {
      const allocated = Number(item?.allocated ?? 0) || 0;
      const spent = Number(item?.spent ?? 0) || 0;
      return {
        // Both spellings are emitted: the dashboard reads `name`, older
        // consumers read `category`.
        name: String(item?.name ?? item?.category ?? 'Uncategorised'),
        category: String(item?.category ?? item?.name ?? 'Uncategorised'),
        allocated,
        spent,
        remaining: Math.round((allocated - spent) * 100) / 100,
        utilisationPct: allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : 0,
      };
    });
    const totalBudget = Number(budget.totalIncome) || 0;
    const totalSpent = breakdown.reduce((sum, b) => sum + b.spent, 0);
    const totalAllocated = breakdown.reduce((sum, b) => sum + b.allocated, 0);
    return {
      id: budget.id,
      year: budget.year,
      month: budget.month === SocietyService.ANNUAL_MONTH ? null : budget.month,
      isAnnual: budget.month === SocietyService.ANNUAL_MONTH,
      // `totalBudget` is what the screen reads; `totalIncome` kept as an alias.
      totalBudget,
      totalIncome: totalBudget,
      totalAllocated: Math.round(totalAllocated * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round((totalBudget - totalSpent) * 100) / 100,
      unallocated: Math.round((totalBudget - totalAllocated) * 100) / 100,
      utilisationPct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
      breakdown,
      // Alias so existing consumers of `lineItems` keep working.
      lineItems: breakdown,
      publishedAt: budget.publishedAt,
      createdAt: budget.createdAt,
    };
  }

  /**
   * Returns the budget for a period.
   *
   * The response is the budget object itself (or null), NOT `{ budget }`. The
   * old wrapper was why the Budget screen rendered "no budget published" even
   * when one existed, and why every total came out `undefined`.
   */
  async getBudget(societyId: string, year?: number, month?: number) {
    const y = year ?? new Date().getFullYear();
    const m = month ?? SocietyService.ANNUAL_MONTH;
    let budget = await this.prisma.societyBudget.findFirst({
      where: { societyId, year: y, month: m },
    });
    // Fall back to a monthly row when no annual budget exists, so a society
    // that published monthly budgets before this change still sees data.
    if (!budget && m === SocietyService.ANNUAL_MONTH) {
      budget = await this.prisma.societyBudget.findFirst({
        where: { societyId, year: y },
        orderBy: { month: 'desc' },
      });
    }
    return this.shapeBudget(budget);
  }

  /** Every published budget, newest first — backs the History tab. */
  async listBudgets(societyId: string) {
    const budgets = await this.prisma.societyBudget.findMany({
      where: { societyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 50,
    });
    return budgets.map((b) => this.shapeBudget(b));
  }

  private normaliseLineItems(dto: { lineItems?: any[]; breakdown?: any[] }) {
    const items = dto.lineItems ?? dto.breakdown ?? [];
    return items
      .filter((item) => item && (item.name ?? item.category))
      .map((item) => ({
        name: String(item.name ?? item.category).trim(),
        category: String(item.category ?? item.name).trim(),
        allocated: Number(item.allocated ?? 0) || 0,
        spent: Number(item.spent ?? 0) || 0,
      }));
  }

  async createBudget(societyId: string, dto: CreateSocietyBudgetDto) {
    const month = dto.month ?? SocietyService.ANNUAL_MONTH;
    const total = dto.totalIncome ?? dto.totalBudget;
    if (total === undefined || total === null || Number.isNaN(Number(total))) {
      throw new BadRequestException({
        code: 'TOTAL_REQUIRED',
        message: 'A total budget amount is required',
      });
    }
    const lineItems = this.normaliseLineItems(dto);
    const allocated = lineItems.reduce((sum, i) => sum + i.allocated, 0);
    if (allocated > Number(total)) {
      throw new BadRequestException({
        code: 'OVER_ALLOCATED',
        message: `Categories allocate ${allocated} but the total budget is ${total}`,
      });
    }

    const existing = await this.prisma.societyBudget.findFirst({
      where: { societyId, year: dto.year, month },
    });
    if (existing) throw new ConflictException('Budget for this period already exists');

    const created = await this.prisma.societyBudget.create({
      data: {
        societyId,
        year: dto.year,
        month,
        totalIncome: Number(total),
        lineItems: lineItems as any,
      },
    });
    return this.shapeBudget(created);
  }

  async updateBudget(id: string, societyId: string, dto: UpdateSocietyBudgetDto) {
    const existing = await this.prisma.societyBudget.findFirst({ where: { id, societyId } });
    if (!existing) throw new NotFoundException('Budget not found');

    const total = dto.totalIncome ?? dto.totalBudget;
    const hasLineItems = dto.lineItems !== undefined || dto.breakdown !== undefined;
    const lineItems = hasLineItems ? this.normaliseLineItems(dto) : null;

    if (lineItems) {
      const cap = total !== undefined ? Number(total) : Number(existing.totalIncome);
      const allocated = lineItems.reduce((sum, i) => sum + i.allocated, 0);
      if (allocated > cap) {
        throw new BadRequestException({
          code: 'OVER_ALLOCATED',
          message: `Categories allocate ${allocated} but the total budget is ${cap}`,
        });
      }
    }

    const updated = await this.prisma.societyBudget.update({
      where: { id },
      data: {
        ...(total !== undefined ? { totalIncome: Number(total) } : {}),
        ...(lineItems ? { lineItems: lineItems as any } : {}),
      },
    });
    return this.shapeBudget(updated);
  }

  // ─── Bylaws (no SocietyBylaw model — stored in society config JSON) ───────
  // TODO: add a proper `SocietyBylaw` Prisma model:
  //   model SocietyBylaw { id String @id @default(cuid()); societyId String;
  //     title String; section String; content String; createdAt DateTime @default(now());
  //     society Society @relation(...); @@index([societyId]); @@map("society_bylaws") }

  async getBylaws(societyId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const bylaws = ((society.config as any)?.bylaws ?? []) as Array<{
      id: string; title: string; section: string; content: string; createdAt: string;
    }>;
    return bylaws.sort((a, b) => a.section.localeCompare(b.section));
  }

  async createBylaw(societyId: string, dto: CreateBylawDto) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const config = (society.config as any) ?? {};
    const bylaws: any[] = config.bylaws ?? [];
    const newBylaw = {
      id: `bylaw_${Date.now()}`,
      title: dto.title,
      section: dto.section,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    bylaws.push(newBylaw);
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...config, bylaws } },
    });
    return newBylaw;
  }

  async updateBylaw(societyId: string, bylawId: string, dto: UpdateBylawDto) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const config = (society.config as any) ?? {};
    const bylaws: any[] = config.bylaws ?? [];
    const idx = bylaws.findIndex((b) => b.id === bylawId);
    if (idx === -1) throw new NotFoundException('Bylaw not found');
    bylaws[idx] = { ...bylaws[idx], ...dto };
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...config, bylaws } },
    });
    return bylaws[idx];
  }

  async deleteBylaw(societyId: string, bylawId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const config = (society.config as any) ?? {};
    const bylaws: any[] = config.bylaws ?? [];
    const idx = bylaws.findIndex((b) => b.id === bylawId);
    if (idx === -1) throw new NotFoundException('Bylaw not found');
    bylaws.splice(idx, 1);
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...config, bylaws } },
    });
    return { deleted: true };
  }
}
