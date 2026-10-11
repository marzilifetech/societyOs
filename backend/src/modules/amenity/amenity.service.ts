import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { PushService } from '../../common/notification/push.service';
import {
  CreateAmenityBookingDto,
  RateAmenityBookingDto,
  CreateAmenityDto,
  UpdateAmenityDto,
} from './dto/amenity.dto';
import { AmenityBookingStatus } from '@prisma/client';

// TODO(schema): Amenity model lacks openTime/closeTime/slotDurationMin/pricePerSlot
// columns. Until a migration adds them, we serialize these into the existing
// `rules` text column as JSON so admin CRUD round-trips cleanly.
type AmenityScheduleRules = {
  openTime?: string;
  closeTime?: string;
  slotDurationMin?: number;
  pricePerSlot?: number;
};

/** The schedule fields stored in `rules` (JSON), or {} when absent/corrupt. */
function readRules(rules: string | null | undefined): AmenityScheduleRules {
  if (!rules) return {};
  try {
    const parsed = JSON.parse(rules);
    return parsed && typeof parsed === 'object' ? (parsed as AmenityScheduleRules) : {};
  } catch {
    return {};
  }
}

function packRules(prev: string | null | undefined, patch: AmenityScheduleRules): string {
  let base: AmenityScheduleRules = {};
  if (prev) {
    try {
      base = JSON.parse(prev);
      if (typeof base !== 'object' || base === null) base = {};
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, ...patch });
}

/**
 * An amenity as the resident app reads it. The model has no `status`, opening
 * hours, `maxCapacity` or hourly price, so every amenity showed "Unavailable"
 * and none could be booked. Hours and price come from the schedule the admin
 * console stores in `rules`.
 */
function presentAmenity<T extends { isActive: boolean; capacity: number; rules: string | null }>(amenity: T) {
  const schedule = readRules(amenity.rules);
  return {
    ...amenity,
    ...schedule,
    status: amenity.isActive ? 'AVAILABLE' : 'UNAVAILABLE',
    availableFrom: schedule.openTime ?? '06:00',
    availableTo: schedule.closeTime ?? '22:00',
    maxCapacity: amenity.capacity,
    pricePerHour: schedule.pricePerSlot ?? 0,
  };
}

@Injectable()
export class AmenityService {
  private readonly logger = new Logger(AmenityService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async findAll(societyId: string) {
    const rows = await this.prisma.amenity.findMany({
      where: { societyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(presentAmenity);
  }

  /** One amenity of the caller's society, as residents see it. */
  async findOneInSociety(id: string, societyId: string) {
    const amenity = await this.prisma.amenity.findFirst({ where: { id, societyId } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    return presentAmenity(amenity);
  }

  /** Amenities with their schedule unpacked from `rules`, for the admin page. */
  async adminFindAll(societyId: string) {
    const rows = await this.prisma.amenity.findMany({
      where: { societyId },
      orderBy: { name: 'asc' },
    });
    return rows.map((a) => ({ ...a, ...readRules(a.rules) }));
  }

  async adminCreate(societyId: string, dto: CreateAmenityDto) {
    return this.prisma.amenity.create({
      data: {
        societyId,
        name: dto.name,
        description: dto.description,
        capacity: dto.capacity ?? 0,
        rules: packRules(null, {
          openTime: dto.openTime,
          closeTime: dto.closeTime,
          slotDurationMin: dto.slotDurationMin,
          pricePerSlot: dto.pricePerSlot,
        }),
      },
    });
  }

  async adminUpdate(societyId: string, id: string, dto: UpdateAmenityDto) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    if (amenity.societyId !== societyId) throw new ForbiddenException('Amenity belongs to another society');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const schedulePatch: AmenityScheduleRules = {};
    if (dto.openTime !== undefined) schedulePatch.openTime = dto.openTime;
    if (dto.closeTime !== undefined) schedulePatch.closeTime = dto.closeTime;
    if (dto.slotDurationMin !== undefined) schedulePatch.slotDurationMin = dto.slotDurationMin;
    if (dto.pricePerSlot !== undefined) schedulePatch.pricePerSlot = dto.pricePerSlot;
    if (Object.keys(schedulePatch).length > 0) {
      data.rules = packRules(amenity.rules, schedulePatch);
    }

    return this.prisma.amenity.update({ where: { id }, data });
  }

  async findOne(id: string) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    return amenity;
  }

  async getAvailability(id: string, date: string, societyId?: string) {
    const amenity = societyId ? await this.findOneInSociety(id, societyId) : await this.findOne(id);
    const bookings = await this.prisma.amenityBooking.findMany({
      where: {
        amenityId: id,
        date: new Date(date),
        status: { in: [AmenityBookingStatus.PENDING, AmenityBookingStatus.CONFIRMED] },
      },
      select: { startSlot: true, endSlot: true, status: true },
    });
    return { amenity, bookedSlots: bookings, date };
  }

  async createBooking(userId: string, dto: CreateAmenityBookingDto, societyId?: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const amenity = await this.findOne(dto.amenityId);
    // Booking used to take any society's amenity id.
    if (societyId && amenity.societyId !== societyId) throw new NotFoundException('Amenity not found');
    if (!amenity.isActive) throw new BadRequestException('Amenity is not active');

    const startSlot = dto.startSlot ?? dto.startTime;
    const endSlot = dto.endSlot ?? dto.endTime;
    if (!startSlot || !endSlot || startSlot >= endSlot) {
      throw new BadRequestException({ code: 'INVALID_SLOT', message: 'Pick a start time before the end time.' });
    }
    const date = new Date(dto.date.slice(0, 10));
    const guestCount = dto.guestCount ?? 1;

    // Nothing stopped two households booking the same slot. Overlapping
    // bookings may share the amenity up to its capacity (a gym); with no
    // capacity set, a booking has it to itself (a party hall).
    const overlapping = await this.prisma.amenityBooking.findMany({
      where: {
        amenityId: amenity.id,
        date,
        status: { in: [AmenityBookingStatus.PENDING, AmenityBookingStatus.CONFIRMED] },
        startSlot: { lt: endSlot },
        endSlot: { gt: startSlot },
      },
      select: { guestCount: true },
    });
    const taken = overlapping.reduce((sum, b) => sum + b.guestCount, 0);
    if (overlapping.length && (amenity.capacity <= 0 || taken + guestCount > amenity.capacity)) {
      throw new ConflictException({ code: 'SLOT_TAKEN', message: 'That time is already booked. Pick another slot.' });
    }

    const booking = await this.prisma.amenityBooking.create({
      data: {
        amenityId: amenity.id,
        residentId: resident.id,
        date,
        startSlot,
        endSlot,
        guestCount,
      },
      include: { amenity: true },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Booking confirmed',
          body: `${booking.amenity.name} is booked for ${booking.date.toLocaleDateString('en-IN')}.`,
          category: 'community',
          collapseKey: `amenity-booking:${booking.id}`,
        },
        { type: 'AMENITY_BOOKING_CONFIRMED', entityId: booking.id, bookingId: booking.id },
      )
      .catch((e) => this.logger.warn(`amenity booking push failed id=${booking.id}: ${(e as Error).message}`));

    return booking;
  }

  async myBookings(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const rows = await this.prisma.amenityBooking.findMany({
      where: { residentId: resident.id },
      include: { amenity: true },
      orderBy: { createdAt: 'desc' },
    });
    // `startTime` / `endTime` are the names the app shows.
    return rows.map((b) => ({ ...b, startTime: b.startSlot, endTime: b.endSlot }));
  }

  async cancelBooking(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const booking = await this.prisma.amenityBooking.findUnique({ where: { id } });
    if (!booking || booking.residentId !== resident.id) throw new NotFoundException('Booking not found');
    if (booking.status === AmenityBookingStatus.CANCELLED) throw new BadRequestException('Already cancelled');

    const cancelled = await this.prisma.amenityBooking.update({
      where: { id },
      data: { status: AmenityBookingStatus.CANCELLED },
      include: { amenity: true },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Booking cancelled',
          body: `Your booking for ${cancelled.amenity.name} on ${cancelled.date.toLocaleDateString('en-IN')} was cancelled.`,
          category: 'community',
          collapseKey: `amenity-booking:${cancelled.id}`,
        },
        { type: 'AMENITY_BOOKING_CANCELLED', entityId: cancelled.id, bookingId: cancelled.id },
      )
      .catch((e) => this.logger.warn(`amenity cancel push failed id=${cancelled.id}: ${(e as Error).message}`));

    return cancelled;
  }

  async rateBooking(id: string, userId: string, dto: RateAmenityBookingDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const booking = await this.prisma.amenityBooking.findUnique({ where: { id } });
    if (!booking || booking.residentId !== resident.id) throw new NotFoundException('Booking not found');
    if (booking.status !== AmenityBookingStatus.COMPLETED) throw new BadRequestException('Can only rate completed bookings');

    return this.prisma.amenityBooking.update({
      where: { id },
      data: { rating: dto.rating, ratingText: dto.ratingText, ratingAt: new Date() },
    });
  }
}
