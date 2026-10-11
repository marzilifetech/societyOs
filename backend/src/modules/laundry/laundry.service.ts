import { BadRequestException, Injectable, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { LaundryBookingStatus, LaundryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';

const SLOTS = ['09:00', '11:00', '14:00', '16:00'];
const IST_OFFSET_MS = 330 * 60 * 1000;

/** The resident app's service names → LaundryType. */
const TYPE_ALIASES: Record<string, LaundryType> = {
  WASH: LaundryType.WASH_AND_FOLD,
  WASH_AND_DRY: LaundryType.WASH_AND_FOLD,
  DRY: LaundryType.DRY_CLEAN,
  IRON: LaundryType.IRON_ONLY,
};

export function laundryTypeOf(input: string): LaundryType {
  const key = input.trim().toUpperCase().replace(/[^A-Z]+/g, '_');
  if ((Object.values(LaundryType) as string[]).includes(key)) return key as LaundryType;
  const aliased = TYPE_ALIASES[key];
  if (!aliased) throw new BadRequestException({ code: 'LAUNDRY_TYPE_INVALID', message: 'Pick a laundry service.' });
  return aliased;
}

/** YYYY-MM-DD + HH:MM in India → the instant. */
export function istInstant(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS);
}

/** An instant as India's calendar date and HH:MM. */
export function istParts(at: Date): { date: string; time: string } {
  const iso = new Date(at.getTime() + IST_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

@Injectable()
export class LaundryService {
  private readonly logger = new Logger(LaundryService.name);
  constructor(private prisma: PrismaService, private s3: S3Service, private push: PushService) {}

  private notifyResident(booking: { id: string; residentId: string; status: string }, type: string, body: string): void {
    void this.prisma.resident
      .findUnique({ where: { id: booking.residentId }, select: { userId: true } })
      .then((resident) => {
        const userId = resident?.userId;
        if (!userId) return;
        return this.push.send(
          userId,
          { title: 'Laundry update', body, category: 'daily_help', collapseKey: `laundry:${booking.id}` },
          { type, entityId: booking.id, bookingId: booking.id, status: String(booking.status) },
        );
      })
      .catch((e) => this.logger.warn(`laundry push failed id=${booking.id}: ${(e as Error).message}`));
  }

  async getBookingById(id: string, societyId: string) {
    return requireOwnedById(
      () =>
        this.prisma.laundryBooking.findUnique({
          where: { id },
          include: { resident: { include: { user: true, flat: true } } },
        }),
      societyId,
      'Booking',
    );
  }

  /**
   * Mark a booking picked up.
   *
   * `dto` used to not exist: the endpoint declared no `@Body()`, so the pickup
   * photo and the garment count the staff app sends were accepted by HTTP and
   * silently discarded — the staff member photographed the load and counted
   * the garments, and none of it was stored. It also never stamped
   * `pickedUpAt`, so "when was this collected" was unanswerable.
   */
  async markPickedUp(
    id: string,
    societyId: string,
    dto?: { photoUrl?: string; garmentCount?: number },
  ) {
    await requireOwnedById(
      () => this.prisma.laundryBooking.findUnique({ where: { id } }),
      societyId,
      'Booking',
    );
    const updated = await this.prisma.laundryBooking.update({
      where: { id },
      data: {
        status: LaundryBookingStatus.PICKED_UP,
        pickedUpAt: new Date(),
        ...(dto?.photoUrl ? { pickupPhotoUrl: dto.photoUrl } : {}),
        // The count at pickup is the authoritative one — it is what was
        // physically collected, versus what the resident estimated when booking.
        ...(Number.isFinite(dto?.garmentCount) && (dto!.garmentCount as number) > 0
          ? { itemCount: Math.round(dto!.garmentCount as number) }
          : {}),
      },
    });
    this.notifyResident(updated, 'LAUNDRY_PICKED_UP', 'Your laundry has been picked up.');
    return updated;
  }

  async getPhotoUploadUrl(id: string, societyId: string, contentType?: string) {
    // Verify the booking belongs to the caller's society before minting an
    // upload URL — otherwise any staff could upload photos against any
    // tenant's booking id.
    await requireOwnedById(
      () => this.prisma.laundryBooking.findUnique({ where: { id } }),
      societyId,
      'Booking',
    );
    return this.s3.getPresignedUploadUrl(`laundry/${id}`, contentType);
  }

  /** Free slots on an IST calendar day (the server runs in UTC). */
  async getSlots(societyId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
      throw new BadRequestException({ code: 'DATE_REQUIRED', message: 'Pick a date.' });
    }
    const start = istInstant(date, '00:00');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    const bookings = await this.prisma.laundryBooking.findMany({
      where: {
        societyId,
        scheduledAt: { gte: start, lte: end },
        status: { not: LaundryBookingStatus.CANCELLED },
      },
      select: { scheduledAt: true },
    });

    const bookedTimes = new Set(bookings.map((b) => istParts(b.scheduledAt).time));

    return SLOTS.filter((s) => !bookedTimes.has(s));
  }

  async createBooking(
    userId: string,
    societyId: string,
    dto: { scheduledAt?: string; date?: string; timeSlot?: string; type: string; itemCount?: number; notes?: string },
  ) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : dto.date && dto.timeSlot
        ? istInstant(dto.date, dto.timeSlot)
        : null;
    if (!scheduledAt) {
      throw new BadRequestException({ code: 'SLOT_REQUIRED', message: 'Pick a date and a time slot.' });
    }
    const created = await this.prisma.laundryBooking.create({
      data: {
        societyId,
        residentId: resident.id,
        scheduledAt,
        type: laundryTypeOf(dto.type),
        itemCount: dto.itemCount ?? 1,
        notes: dto.notes,
      },
    });
    return withAppFields(created);
  }

  async getMyBookings(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const rows = await this.prisma.laundryBooking.findMany({
      where: { residentId: resident.id },
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map(withAppFields);
  }

  async cancelBooking(userId: string, id: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const booking = await requireOwnedById(
      () => this.prisma.laundryBooking.findUnique({ where: { id } }),
      societyId,
      'Booking',
    );
    if (booking.residentId !== resident.id) throw new ForbiddenException();
    if (booking.status !== LaundryBookingStatus.SCHEDULED) {
      throw new ForbiddenException('Only SCHEDULED bookings can be cancelled');
    }
    return this.prisma.laundryBooking.update({
      where: { id },
      data: { status: LaundryBookingStatus.CANCELLED },
    });
  }

  async getAll(societyId: string, status?: LaundryBookingStatus) {
    return this.prisma.laundryBooking.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async updateStatus(id: string, societyId: string, status: LaundryBookingStatus) {
    await requireOwnedById(
      () => this.prisma.laundryBooking.findUnique({ where: { id } }),
      societyId,
      'Booking',
    );
    const updated = await this.prisma.laundryBooking.update({
      where: { id },
      data: { status },
    });
    const bodyByStatus: Record<string, { type: string; body: string }> = {
      [LaundryBookingStatus.READY]: { type: 'LAUNDRY_READY', body: 'Your laundry is ready.' },
      [LaundryBookingStatus.PICKED_UP]: { type: 'LAUNDRY_PICKED_UP', body: 'Your laundry has been picked up.' },
      [LaundryBookingStatus.CANCELLED]: { type: 'LAUNDRY_CANCELLED', body: 'Your laundry booking has been cancelled.' },
    };
    const mapped = bodyByStatus[status];
    if (mapped) this.notifyResident(updated, mapped.type, mapped.body);
    return updated;
  }
}

/** `date` and `timeSlot` (IST) are what the resident app shows. */
function withAppFields<T extends { scheduledAt: Date }>(booking: T) {
  const { date, time } = istParts(booking.scheduledAt);
  return { ...booking, date, timeSlot: time };
}
