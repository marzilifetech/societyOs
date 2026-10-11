import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DomesticAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import {
  CreateDomesticHelpDto,
  UpdateDomesticHelpDto,
  MarkAttendanceDto,
  LogSalaryPaymentDto,
} from './dto/domestic-help.dto';
import { istDateOf } from '../staff/attendance-time';

@Injectable()
export class DomesticHelpService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateDomesticHelpDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.domesticHelp.create({
      data: {
        residentId: resident.id,
        name: dto.name,
        role: dto.role,
        phone: dto.phone,
        photoUrl: dto.photoUrl,
        gateAccess: dto.gateAccess ?? false,
      },
    });
  }

  /** The resident's helpers, each with whether they came today (IST). */
  async findAll(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const today = istDateOf(new Date());
    const helpers = await this.prisma.domesticHelp.findMany({
      where: { residentId: resident.id },
      include: { attendance: { where: { date: today }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return helpers.map(({ attendance, ...h }) => ({ ...h, presentToday: presenceOf(attendance[0]?.status) }));
  }

  /**
   * One helper with the last 30 attendance days, as rows and as the
   * date → status map the app's calendar reads (`monthlyAttendance`; reading
   * it when it was missing crashed the screen), plus the last salary paid.
   */
  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({
      where: { id },
      include: {
        attendance: { orderBy: { date: 'desc' }, take: 30 },
        payments: { orderBy: { paidAt: 'desc' }, take: 1 },
      },
    });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    const { payments, ...rest } = help;
    const today = istDateOf(new Date()).toISOString().slice(0, 10);
    // Lower-case values: what the calendar in installed app builds keys on
    // (present / absent / holiday). Current builds read `attendance` rows.
    const monthlyAttendance = Object.fromEntries(
      help.attendance.map((a) => [a.date.toISOString().slice(0, 10), a.status.toLowerCase()]),
    );
    const last = payments[0];
    return {
      ...rest,
      monthlyAttendance,
      presentToday: presenceOf(help.attendance.find((a) => a.date.toISOString().slice(0, 10) === today)?.status),
      lastPayment: last ? { amount: Number(last.amount), date: last.paidAt } : null,
    };
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
    // Attendance rows have no cascade, so deleting a helper with any history failed.
    const [, , removed] = await this.prisma.$transaction([
      this.prisma.domesticAttendance.deleteMany({ where: { domesticHelpId: id } }),
      this.prisma.domesticHelpPayment.deleteMany({ where: { domesticHelpId: id } }),
      this.prisma.domesticHelp.delete({ where: { id } }),
    ]);
    return removed;
  }

  async markAttendance(id: string, userId: string, dto: MarkAttendanceDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');

    const status =
      dto.status ?? (dto.present === undefined ? undefined : dto.present ? DomesticAttendanceStatus.PRESENT : DomesticAttendanceStatus.ABSENT);
    if (!status) throw new BadRequestException({ code: 'STATUS_REQUIRED', message: 'Say whether the helper came.' });
    // One row per helper per day, whatever time-of-day the date string carries.
    const day = dto.date.slice(0, 10);

    return this.prisma.domesticAttendance.upsert({
      where: {
        id: `${id}_${day}`,
      },
      create: {
        id: `${id}_${day}`,
        domesticHelpId: id,
        date: new Date(day),
        status,
        notes: dto.notes,
      },
      update: { status, notes: dto.notes },
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

  /**
   * Record cash the resident paid their helper. The route took no body and
   * stored nothing, while the app said "Salary payment recorded".
   */
  async logSalaryPayment(id: string, userId: string, dto: LogSalaryPaymentDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const help = await this.prisma.domesticHelp.findUnique({ where: { id } });
    if (!help || help.residentId !== resident.id) throw new NotFoundException('Domestic help not found');
    const payment = await this.prisma.domesticHelpPayment.create({
      data: { domesticHelpId: id, amount: dto.amount, ...(dto.paidAt ? { paidAt: new Date(dto.paidAt) } : {}) },
    });
    return {
      domesticHelpId: id,
      salary: help.salary == null ? null : Number(help.salary),
      currency: 'INR',
      lastPayment: { amount: Number(payment.amount), date: payment.paidAt },
    };
  }
}

/** true = came, false = absent, null = not marked. */
function presenceOf(status: DomesticAttendanceStatus | undefined): boolean | null {
  if (!status) return null;
  return status === DomesticAttendanceStatus.PRESENT || status === DomesticAttendanceStatus.HALF_DAY;
}
