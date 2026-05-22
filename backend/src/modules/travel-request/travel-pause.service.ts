import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateTravelPauseDto } from './dto/travel-pause.dto';

@Injectable()
export class TravelPauseService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTravelPauseDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.travelPause.create({
      data: {
        residentId: resident.id,
        startDate: new Date(dto.startDate),
        returnDate: new Date(dto.returnDate),
        servicesPaused: dto.servicesPaused,
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async findByResident(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.travelPause.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markReturned(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const pause = await this.prisma.travelPause.findUnique({ where: { id } });
    if (!pause) throw new NotFoundException('Travel pause not found');
    if (pause.residentId !== resident.id) throw new ForbiddenException();
    return this.prisma.travelPause.update({
      where: { id },
      data: { actualReturnDate: new Date(), status: 'COMPLETED' },
    });
  }

  // ── Admin methods ─────────────────────────────────────────────────────────────

  async findBySociety(societyId: string, status?: string, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length ? { block: { in: managedBlocks } } : {};
    return this.prisma.travelPause.findMany({
      where: {
        resident: { flat: { societyId, ...blockWhere } },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        resident: {
          include: { user: { select: { name: true, email: true } }, flat: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, societyId: string) {
    const pause = await this._requireBySociety(id, societyId);
    return this.prisma.travelPause.update({
      where: { id: pause.id },
      data: { status: 'ACTIVE' },
    });
  }

  async reject(id: string, societyId: string) {
    const pause = await this._requireBySociety(id, societyId);
    return this.prisma.travelPause.update({
      where: { id: pause.id },
      data: { status: 'CANCELLED' },
    });
  }

  private async _requireBySociety(id: string, societyId: string) {
    const pause = await this.prisma.travelPause.findUnique({
      where: { id },
      include: { resident: { include: { flat: true } } },
    });
    if (!pause) throw new NotFoundException('Travel pause not found');
    if (pause.resident.flat.societyId !== societyId) throw new ForbiddenException();
    return pause;
  }
}
