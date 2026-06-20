import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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

@Injectable()
export class AmenityService {
  private readonly logger = new Logger(AmenityService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async findAll(societyId: string) {
    return this.prisma.amenity.findMany({
      where: { societyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async adminFindAll(societyId: string) {
    return this.prisma.amenity.findMany({
      where: { societyId },
      orderBy: { name: 'asc' },
    });
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

  async getAvailability(id: string, date: string) {
    const amenity = await this.findOne(id);
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

  async createBooking(userId: string, dto: CreateAmenityBookingDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const amenity = await this.findOne(dto.amenityId);
    if (!amenity.isActive) throw new BadRequestException('Amenity is not active');

    const booking = await this.prisma.amenityBooking.create({
      data: {
        amenityId: dto.amenityId,
        residentId: resident.id,
        date: new Date(dto.date),
        startSlot: dto.startSlot,
        endSlot: dto.endSlot,
        guestCount: dto.guestCount ?? 1,
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
    return this.prisma.amenityBooking.findMany({
      where: { residentId: resident.id },
      include: { amenity: true },
      orderBy: { createdAt: 'desc' },
    });
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
