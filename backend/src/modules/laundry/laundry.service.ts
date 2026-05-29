import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LaundryBookingStatus, LaundryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';

const SLOTS = ['09:00', '11:00', '14:00', '16:00'];

@Injectable()
export class LaundryService {
  constructor(private prisma: PrismaService, private s3: S3Service) {}

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

  async markPickedUp(id: string, societyId: string) {
    await requireOwnedById(
      () => this.prisma.laundryBooking.findUnique({ where: { id } }),
      societyId,
      'Booking',
    );
    return this.prisma.laundryBooking.update({
      where: { id },
      data: { status: LaundryBookingStatus.PICKED_UP },
    });
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

  async getSlots(societyId: string, date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.laundryBooking.findMany({
      where: {
        societyId,
        scheduledAt: { gte: start, lte: end },
        status: { not: LaundryBookingStatus.CANCELLED },
      },
      select: { scheduledAt: true },
    });

    const bookedTimes = new Set(
      bookings.map((b) => {
        const h = b.scheduledAt.getHours().toString().padStart(2, '0');
        const m = b.scheduledAt.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      }),
    );

    return SLOTS.filter((s) => !bookedTimes.has(s));
  }

  async createBooking(
    userId: string,
    societyId: string,
    dto: { scheduledAt: string; type: LaundryType; itemCount: number; notes?: string },
  ) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.laundryBooking.create({
      data: {
        societyId,
        residentId: resident.id,
        scheduledAt: new Date(dto.scheduledAt),
        type: dto.type,
        itemCount: dto.itemCount,
        notes: dto.notes,
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  async getMyBookings(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.laundryBooking.findMany({
      where: { residentId: resident.id },
      orderBy: { scheduledAt: 'desc' },
    });
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
    return this.prisma.laundryBooking.update({
      where: { id },
      data: { status },
    });
  }
}
