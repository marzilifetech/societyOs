import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSocietyBudgetDto, UpdateSocietyBudgetDto, CreateBylawDto, UpdateBylawDto } from './dto/society.dto';

@Injectable()
export class SocietyService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const all = await this.prisma.society.findMany({ select: { id: true, name: true, city: true } });
    const seen = new Set<string>();
    return all.filter(s => {
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

  async getBudget(societyId: string, year?: number, month?: number) {
    const y = year ?? new Date().getFullYear();
    const m = month ?? new Date().getMonth() + 1;
    const budget = await this.prisma.societyBudget.findFirst({
      where: { societyId, year: y, month: m },
    });
    return { budget: budget ?? null };
  }

  async createBudget(societyId: string, dto: CreateSocietyBudgetDto) {
    const existing = await this.prisma.societyBudget.findFirst({
      where: { societyId, year: dto.year, month: dto.month },
    });
    if (existing) throw new ConflictException('Budget for this month/year already exists');
    return this.prisma.societyBudget.create({
      data: {
        societyId,
        year: dto.year,
        month: dto.month,
        totalIncome: dto.totalIncome,
        lineItems: (dto.lineItems ?? []) as any,
      },
    });
  }

  async updateBudget(id: string, societyId: string, dto: UpdateSocietyBudgetDto) {
    const existing = await this.prisma.societyBudget.findFirst({ where: { id, societyId } });
    if (!existing) throw new NotFoundException('Budget not found');
    return this.prisma.societyBudget.update({
      where: { id },
      data: {
        ...(dto.totalIncome !== undefined ? { totalIncome: dto.totalIncome } : {}),
        ...(dto.lineItems !== undefined ? { lineItems: dto.lineItems as any } : {}),
      },
    });
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
