import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateDomesticHelpDto, UpdateDomesticHelpDto, MarkAttendanceDto } from './dto/domestic-help.dto';

@Injectable()
export class DomesticHelpService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateDomesticHelpDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.domesticHelp.create({
      data: { residentId: resident.id, ...dto },
    });
  }

  async findAll(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.domesticHelp.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({
      where: { id },
      include: { attendance: { orderBy: { date: 'desc' }, take: 30 } },
    });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    return help;
  }

  async update(id: string, userId: string, dto: UpdateDomesticHelpDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    return this.prisma.domesticHelp.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    return this.prisma.domesticHelp.delete({ where: { id } });
  }

  async markAttendance(id: string, userId: string, dto: MarkAttendanceDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');

    return this.prisma.domesticAttendance.upsert({
      where: {
        id: `${id}_${dto.date}`,
      },
      create: {
        id: `${id}_${dto.date}`,
        domesticHelpId: id,
        date: new Date(dto.date),
        status: dto.status,
        notes: dto.notes,
      },
      update: { status: dto.status, notes: dto.notes },
    });
  }

  async getAttendance(id: string, userId: string, month: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');

    const [year, mon] = month.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59);

    return this.prisma.domesticAttendance.findMany({
      where: {
        domesticHelpId: id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getSalary(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    return { domesticHelpId: id, salary: help.salary, currency: 'INR' };
  }
}
