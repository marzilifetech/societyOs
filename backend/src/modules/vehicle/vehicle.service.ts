import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateVehicleDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.vehicle.create({
      data: { residentId: resident.id, ...dto },
    });
  }

  async findMy(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.vehicle.findMany({
      where: { residentId: resident.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, userId: string, dto: UpdateVehicleDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.residentId !== resident.id) throw new NotFoundException('Vehicle not found');
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.residentId !== resident.id) throw new NotFoundException('Vehicle not found');
    return this.prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  }

  async getEntryLog() {
    const entries = await this.prisma.vehicle.findMany({
      where: { isActive: true },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { entries };
  }

  async getEntryLogForResident(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
      include: { resident: { include: { user: true, flat: true } } },
    });
    return { entries: vehicles };
  }
}
