import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import {
  RequestGuestParkingDto,
  ReportUnauthorizedDto,
  GuestParkingRequestDto,
  LogGuestParkingDto,
} from './dto/parking.dto';
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
    const guestsOnSite = await this.prisma.guestParkingLog.count({
      where: { societyId, exitAt: null },
    });
    return {
      total,
      occupied,
      available: Math.max(0, total - occupied),
      guestsOnSite,
    };
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

  // ── Admin / gate guest parking ────────────────────────────────────────────
  //
  // The dashboard's "Log Guest Parking" button posted to POST /parking/guest,
  // which is @Roles(RESIDENT) and calls requireResidentByUserId() on the
  // caller. An admin is not a resident, so the button 403'd every time — the
  // "Log guest parking is not functional" report. Gate-side logging is a
  // genuinely different operation (no host resident, needs an occupancy
  // lifecycle) and gets its own record.

  /**
   * Log a guest vehicle at the gate. Optionally occupies a VISITOR slot; when
   * `slotId` is omitted the first free VISITOR slot is auto-assigned so the
   * availability counter stays honest.
   */
  async logGuestParking(
    societyId: string,
    loggedById: string,
    dto: LogGuestParkingDto,
  ) {
    const plate = dto.vehiclePlate.trim().toUpperCase();
    if (!plate) {
      throw new BadRequestException({ code: 'PLATE_REQUIRED', message: 'Vehicle plate is required' });
    }

    // Same plate already parked and not yet exited -> reject rather than
    // silently double-occupying a bay.
    const openForPlate = await this.prisma.guestParkingLog.findFirst({
      where: { societyId, vehiclePlate: plate, exitAt: null },
    });
    if (openForPlate) {
      throw new ConflictException({
        code: 'ALREADY_PARKED',
        message: `${plate} is already logged in and has not exited yet`,
        logId: openForPlate.id,
      });
    }

    let slotId: string | null = null;
    if (dto.slotId) {
      const slot = await this.prisma.parkingSlot.findFirst({
        where: { id: dto.slotId, societyId },
      });
      if (!slot) {
        throw new NotFoundException({ code: 'SLOT_NOT_FOUND', message: 'Parking slot not found' });
      }
      if (slot.isOccupied) {
        throw new ConflictException({ code: 'SLOT_OCCUPIED', message: `Slot ${slot.slotNumber} is occupied` });
      }
      slotId = slot.id;
    } else {
      const free = await this.prisma.parkingSlot.findFirst({
        where: { societyId, type: ParkingSlotType.VISITOR, isOccupied: false },
        orderBy: { slotNumber: 'asc' },
      });
      slotId = free?.id ?? null; // no visitor bays configured -> log without one
    }

    const log = await this.prisma.guestParkingLog.create({
      data: {
        societyId,
        slotId,
        vehiclePlate: plate,
        visitorName: dto.visitorName?.trim() || null,
        flatLabel: dto.flatLabel?.trim() || null,
        notes: dto.notes?.trim() || null,
        loggedById,
      },
      include: { slot: true },
    });

    if (slotId) {
      await this.prisma.parkingSlot.update({ where: { id: slotId }, data: { isOccupied: true } });
    }

    return {
      id: log.id,
      vehiclePlate: log.vehiclePlate,
      visitorName: log.visitorName,
      flatLabel: log.flatLabel,
      notes: log.notes,
      slot: log.slot ? { id: log.slot.id, slotNumber: log.slot.slotNumber } : null,
      entryAt: log.entryAt,
      exitAt: null as Date | null,
      slotAssigned: Boolean(slotId),
    };
  }

  /** Mark a guest vehicle as departed and release its bay. */
  async exitGuestParking(societyId: string, logId: string) {
    const log = await this.prisma.guestParkingLog.findFirst({ where: { id: logId, societyId } });
    if (!log) throw new NotFoundException({ code: 'LOG_NOT_FOUND', message: 'Guest parking entry not found' });
    if (log.exitAt) return { ...log, alreadyExited: true };

    const updated = await this.prisma.guestParkingLog.update({
      where: { id: logId },
      data: { exitAt: new Date() },
    });
    if (log.slotId) {
      await this.prisma.parkingSlot
        .update({ where: { id: log.slotId }, data: { isOccupied: false } })
        .catch(() => undefined);
    }
    return { ...updated, alreadyExited: false };
  }

  /** Guest parking log. `active=true` returns only vehicles still on-site. */
  async listGuestParking(societyId: string, active?: boolean) {
    const logs = await this.prisma.guestParkingLog.findMany({
      where: { societyId, ...(active ? { exitAt: null } : {}) },
      include: { slot: { select: { id: true, slotNumber: true } } },
      orderBy: { entryAt: 'desc' },
      take: 200,
    });
    return logs.map((log) => ({
      id: log.id,
      vehiclePlate: log.vehiclePlate,
      visitorName: log.visitorName,
      flatLabel: log.flatLabel,
      notes: log.notes,
      slot: log.slot,
      entryAt: log.entryAt,
      exitAt: log.exitAt,
      isParked: log.exitAt == null,
      durationMinutes: Math.max(
        0,
        Math.round(((log.exitAt ?? new Date()).getTime() - log.entryAt.getTime()) / 60_000),
      ),
    }));
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
