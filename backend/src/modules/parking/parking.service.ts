import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { RequestGuestParkingDto, ReportUnauthorizedDto, GuestParkingRequestDto } from './dto/parking.dto';
import { ParkingSlotType, IncidentType, IncidentSeverity } from '@prisma/client';

@Injectable()
export class ParkingService {
  constructor(private prisma: PrismaService) {}

  async getMySlot(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (!resident.parkingSlotId) return { slot: null };
    const slot = await this.prisma.parkingSlot.findUnique({ where: { id: resident.parkingSlotId } });
    return { slot };
  }

  async getMySlots(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.parkingSlot.findMany({
      where: {
        residents: { some: { id: resident.id } },
      },
    });
  }

  async createGuestRequest(userId: string, societyId: string, dto: GuestParkingRequestDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const visitor = await this.prisma.visitor.create({
      data: {
        residentId: resident.id,
        name: dto.visitorName,
        purpose: 'PARKING',
        vehicleNo: dto.vehicleNumber,
        status: 'EXPECTED',
        validFrom: new Date(dto.date),
      },
    });
    return {
      visitorId: visitor.id,
      visitorName: visitor.name,
      vehicleNumber: dto.vehicleNumber,
      date: dto.date,
      duration: dto.duration,
      notes: dto.notes ?? null,
      status: visitor.status,
      requestedAt: visitor.createdAt,
    };
  }

  async getGuestRequests(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const visitors = await this.prisma.visitor.findMany({
      where: { residentId: resident.id, purpose: 'PARKING' },
      orderBy: { createdAt: 'desc' },
    });
    return visitors;
  }

  async getAllSlots(societyId: string) {
    const slots = await this.prisma.parkingSlot.findMany({
      where: { societyId },
      include: { residents: { include: { user: true, flat: true } } },
      orderBy: { slotNumber: 'asc' },
    });
    return slots.map((slot) => ({
      id: slot.id,
      slotNumber: slot.slotNumber,
      type: slot.type,
      isOccupied: slot.isOccupied,
      assignedResident: slot.residents[0]
        ? {
            id: slot.residents[0].id,
            name: slot.residents[0].user?.name,
            flat: slot.residents[0].flat?.number,
          }
        : null,
    }));
  }

  async getAvailability(societyId: string) {
    const total = await this.prisma.parkingSlot.count({
      where: { societyId, type: ParkingSlotType.VISITOR },
    });
    const occupied = await this.prisma.parkingSlot.count({
      where: { societyId, type: ParkingSlotType.VISITOR, isOccupied: true },
    });
    return { total, occupied, available: total - occupied };
  }

  async requestGuestParking(userId: string, societyId: string, dto: RequestGuestParkingDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const visitor = await this.prisma.visitor.create({
      data: {
        residentId: resident.id,
        name: dto.visitorName ?? 'Guest',
        purpose: dto.notes ?? 'PARKING',
        vehicleNo: dto.vehiclePlate,
        status: 'EXPECTED',
      },
    });
    return {
      message: 'Guest parking request submitted',
      vehiclePlate: dto.vehiclePlate,
      visitorName: visitor.name,
      requestedAt: visitor.createdAt,
      visitorId: visitor.id,
    };
  }

  async reportUnauthorized(userId: string, societyId: string, dto: ReportUnauthorizedDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.securityIncident.create({
      data: {
        societyId,
        reportedBy: resident.id,
        type: IncidentType.SUSPICIOUS_ACTIVITY,
        description: `Unauthorized vehicle reported in slot ${dto.slotNumber}. Vehicle plate: ${dto.vehiclePlate}`,
        severity: IncidentSeverity.MEDIUM,
      },
    });
  }
}
