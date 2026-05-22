import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorStatus } from '@prisma/client';
import { CreateVisitorDto, CheckInVisitorDto } from './dto/visitor.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { randomBytes } from 'crypto';
import { VisitorGateway } from './visitor.gateway';

type VisitorWithResidentFlat = {
  resident: { flat: { societyId: string } };
};

@Injectable()
export class VisitorService {
  constructor(
    private prisma: PrismaService,
    private visitorGateway: VisitorGateway,
  ) {}

  private assertSameSociety(visitor: VisitorWithResidentFlat, societyId: string) {
    if (visitor.resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'VISITOR_SOCIETY_MISMATCH',
        message: 'This visitor pass belongs to another society',
      });
    }
  }

  /** QR gate: time window + revoked/expired rows (not applied when re-reading an already checked-in pass — see checkIn). */
  private assertQrGateEligible(visitor: VisitorWithResidentFlat & {
    status: VisitorStatus;
    validFrom: Date | null;
    validUntil: Date | null;
  }) {
    const now = new Date();
    if (visitor.validFrom && now < visitor.validFrom) {
      throw new GoneException({
        code: 'QR_NOT_YET_VALID',
        message: 'This visitor pass is not valid yet',
      });
    }
    if (visitor.validUntil && now > visitor.validUntil) {
      throw new GoneException({
        code: 'QR_EXPIRED',
        message: 'This visitor pass has expired',
      });
    }
    if (visitor.status === VisitorStatus.DENIED) {
      throw new GoneException({
        code: 'QR_INVALIDATED',
        message: 'This visitor pass has been revoked',
      });
    }
    if (visitor.status === VisitorStatus.EXPIRED) {
      throw new GoneException({
        code: 'QR_EXPIRED',
        message: 'This visitor pass has expired',
      });
    }
    if (visitor.status === VisitorStatus.CHECKED_OUT) {
      throw new GoneException({
        code: 'QR_VISIT_ENDED',
        message: 'This visitor has already checked out',
      });
    }
  }

  async create(userId: string, societyId: string, dto: CreateVisitorDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'RESIDENT_SOCIETY_MISMATCH',
        message: 'Resident is not in this society context',
      });
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : new Date();
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);

    const recurringSchedule =
      dto.isRecurring && dto.recurringDays?.length
        ? { days: dto.recurringDays, until: dto.recurringUntil ?? null }
        : undefined;

    return this.prisma.visitor.create({
      data: {
        residentId: resident.id,
        name: dto.name,
        phone: dto.phone,
        purpose: dto.purpose,
        vehicleNo: dto.vehicleNo,
        photoUrl: dto.photoUrl,
        qrToken: randomBytes(4).toString('hex').toUpperCase(),
        validFrom,
        validUntil,
        status: VisitorStatus.EXPECTED,
        isRecurring: dto.isRecurring ?? false,
        ...(recurringSchedule !== undefined && { recurringSchedule }),
      },
    });
  }

  async findByResident(userId: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'RESIDENT_SOCIETY_MISMATCH',
        message: 'Resident is not in this society context',
      });
    }

    return this.prisma.visitor.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findById(id: string, societyId: string, userId?: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }

    this.assertSameSociety(visitor, societyId);

    if (userId) {
      const resident = await requireResidentByUserId(this.prisma, userId);
      if (resident.flat.societyId !== societyId) {
        throw new ForbiddenException({
          code: 'RESIDENT_SOCIETY_MISMATCH',
          message: 'Resident is not in this society context',
        });
      }
      if (visitor.residentId !== resident.id) {
        throw new ForbiddenException({
          code: 'VISITOR_NOT_OWNER',
          message: 'Visitor does not belong to this resident',
        });
      }
    }

    return visitor;
  }

  async findByQr(qrToken: string, societyId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { qrToken },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }

    this.assertSameSociety(visitor, societyId);

    // Allow lookup while CHECKED_IN so gate UI can show “already on premises”; other terminal states go 410.
    if (visitor.status !== VisitorStatus.CHECKED_IN) {
      this.assertQrGateEligible(visitor);
    }

    return visitor;
  }

  async checkIn(dto: CheckInVisitorDto, guardUserId: string, societyId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { qrToken: dto.qrToken },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }

    this.assertSameSociety(visitor, societyId);

    // Idempotent check-in: repeat scan returns the same row, no duplicate updates (409-style conflicts avoided).
    if (visitor.status === VisitorStatus.CHECKED_IN) {
      return visitor;
    }

    this.assertQrGateEligible(visitor);

    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        status: VisitorStatus.CHECKED_IN,
        entryAt: new Date(),
        checkedInBy: guardUserId,
      },
      include: { resident: { include: { flat: true } } },
    });

    this.visitorGateway.emitVisitorArrived(updated.residentId, {
      visitorName: updated.name,
      photo: updated.photoUrl ?? null,
      vehicleNumber: updated.vehicleNo ?? null,
      time: (updated.entryAt ?? new Date()).toISOString(),
    });

    return updated;
  }

  async checkOut(visitorId: string, societyId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }
    this.assertSameSociety(visitor, societyId);

    // Idempotent: repeat checkout returns the same row (gate / guard double-submit).
    if (visitor.status === VisitorStatus.CHECKED_OUT) {
      return visitor;
    }

    if (visitor.status !== VisitorStatus.CHECKED_IN) {
      throw new ConflictException({
        code: 'CHECKOUT_INVALID_STATE',
        message: 'Visitor must be checked in before checkout',
        currentStatus: visitor.status,
      });
    }

    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { status: VisitorStatus.CHECKED_OUT, exitAt: new Date() },
    });
  }

  async deny(visitorId: string, societyId: string, userId?: string) {
    const existing = await this.findById(visitorId, societyId, userId);
    if (existing.status === VisitorStatus.DENIED) {
      return existing;
    }
    if (existing.status === VisitorStatus.CHECKED_IN || existing.status === VisitorStatus.CHECKED_OUT) {
      throw new ConflictException({
        code: 'DENY_NOT_ALLOWED',
        message: 'Cannot deny a visitor that has already entered or completed their visit',
        currentStatus: existing.status,
      });
    }

    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { status: VisitorStatus.DENIED },
    });
  }
}
