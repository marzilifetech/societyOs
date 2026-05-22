import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreatePestControlDto } from './dto/create-pest-control.dto';

@Injectable()
export class PestControlService {
  private readonly logger = new Logger(PestControlService.name);
  constructor(private prisma: PrismaService) {}

  async findUpcoming(userId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = {
      societyId: resident.flat.societyId,
      status: 'SCHEDULED',
      scheduledAt: { gte: new Date() },
    };
    const [data, total] = await Promise.all([
      this.prisma.pestControlSchedule.findMany({
        where,
        select: {
          id: true, type: true, scheduledAt: true, areas: true,
          notes: true, status: true, createdAt: true,
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.pestControlSchedule.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findOne(id: string) {
    const schedule = await this.prisma.pestControlSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('Pest control schedule not found');
    return schedule;
  }

  async create(societyId: string, dto: CreatePestControlDto) {
    return this.prisma.pestControlSchedule.create({
      data: {
        societyId,
        type: dto.type as any,
        scheduledAt: new Date(dto.scheduledAt),
        areas: dto.areas,
        notes: dto.notes,
        status: 'SCHEDULED',
      },
    });
  }

  async complete(id: string) {
    const schedule = await this.findOne(id);
    return this.prisma.pestControlSchedule.update({
      where: { id: schedule.id },
      data: { status: 'COMPLETED' as any, completedAt: new Date() },
    });
  }

  async cancel(id: string) {
    const schedule = await this.findOne(id);
    return this.prisma.pestControlSchedule.update({
      where: { id: schedule.id },
      data: { status: 'CANCELLED' as any },
    });
  }
}
