import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorStatus } from '@prisma/client';
import { CreateAtGateVisitorDto, CreateVisitorDto, CheckInVisitorDto } from './dto/visitor.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { randomBytes } from 'crypto';
import { VisitorGateway } from './visitor.gateway';
import { PushService } from '../../common/notification/push.service';

type VisitorWithResidentFlat = {
  resident: { flat: { societyId: string } };
};

@Injectable()
export class VisitorService {
  constructor(
    private prisma: PrismaService,
    private visitorGateway: VisitorGateway,
    private push: PushService,
  ) {}

  /**
   * Fire the actionable visitor-arrival push to the resident (photo + name +
   * time). Best-effort: never blocks or fails the gate check-in. The push is
   * data-tagged VISITOR_ARRIVAL so the app routes a tap to the approve/deny
   * review screen for this visit.
   */
  private notifyResidentArrival(visitor: {
    id: string;
    name: string;
    photoUrl?: string | null;
    entryAt?: Date | null;
    resident?: { userId?: string | null } | null;
  }): void {
    try {
      const userId = visitor?.resident?.userId;
      if (!userId) return;
      const time = (visitor.entryAt ?? new Date()).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
      void this.push
        .send(
          userId,
          {
            title: 'Visitor at the gate',
            body: `${visitor.name} · ${time}`,
            category: 'visitors_gate',
            ...(visitor.photoUrl ? { imageUrl: visitor.photoUrl } : {}),
            collapseKey: `visitor:${visitor.id}`,
          },
          { type: 'VISITOR_ARRIVAL', visitId: visitor.id, visitorName: visitor.name },
        )
        .catch(() => {
          /* best-effort; gate flow must not depend on push delivery */
        });
    } catch {
      /* never let an arrival push break the gate check-in */
    }
  }

  /**
   * Guard added a walk-in visitor — fire actionable push (photo + name + purpose
   * + Approve / Reject) so the resident can decide from the lockscreen. The
   * decide() endpoint is idempotent, so duplicate taps and multi-device fan-out
   * collapse safely. Best-effort: never blocks visitor creation.
   */
  private notifyResidentPendingApproval(visitor: {
    id: string;
    name: string;
    purpose?: string | null;
    photoUrl?: string | null;
    resident?: { userId?: string | null } | null;
  }): void {
    try {
      const userId = visitor?.resident?.userId;
      if (!userId) return;
      const purpose = visitor.purpose?.trim();
      const body = purpose
        ? `${visitor.name} (${purpose}) is at the gate. Approve entry?`
        : `${visitor.name} is at the gate. Approve entry?`;
      void this.push
        .send(
          userId,
          {
            title: 'Visitor at the gate',
            body,
            category: 'visitors_gate',
            ...(visitor.photoUrl ? { imageUrl: visitor.photoUrl } : {}),
            collapseKey: `visitor:${visitor.id}`,
            actions: [
              { id: 'APPROVE', title: 'Approve' },
              { id: 'REJECT', title: 'Reject', destructive: true },
            ],
          },
          {
            type: 'VISITOR_APPROVAL_REQUEST',
            visitId: visitor.id,
            visitorName: visitor.name,
            actionGroup: 'visitor_approval',
            ...(purpose ? { purpose } : {}),
          },
        )
        .catch(() => {
          /* best-effort; gate flow must not depend on push delivery */
        });
    } catch {
      /* never let an approval push break visitor creation */
    }
  }

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

  /**
   * Guard-side walk-in: the visitor showed up unannounced and the guard creates
   * a row targeting a specific resident. The visitor is PENDING approval; an
   * actionable push fires to the resident so they can Approve/Reject from the
   * lockscreen. Check-in is blocked until that decision lands.
   */
  async createAtGate(guardUserId: string, societyId: string, dto: CreateAtGateVisitorDto) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: dto.residentId, flat: { societyId } },
      include: { flat: true, user: true },
    });
    if (!resident) {
      throw new NotFoundException({
        code: 'RESIDENT_NOT_FOUND',
        message: 'Resident not found in this society',
      });
    }

    const validFrom = new Date();
    const validUntil = new Date(validFrom.getTime() + 12 * 60 * 60 * 1000);

    const created = await this.prisma.visitor.create({
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
        approvalStatus: 'PENDING',
      },
      include: { resident: { include: { user: true, flat: true } } },
    });

    void guardUserId; // reserved for future audit; create itself is anonymous on the guard side today

    this.notifyResidentPendingApproval(created);

    return created;
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

    if (visitor.approvalStatus === 'PENDING') {
      throw new ForbiddenException({
        code: 'VISITOR_PENDING_APPROVAL',
        message: 'Visitor entry requires admin approval before check-in',
      });
    }
    if (visitor.approvalStatus === 'REJECTED') {
      throw new ForbiddenException({
        code: 'VISITOR_REJECTED',
        message: 'This visitor entry was rejected',
      });
    }

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

    // Actionable visitor-arrival push to the resident (photo + name + time).
    this.notifyResidentArrival(updated);

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

  async listForSociety(
    societyId: string,
    opts?: { approvalStatus?: string; date?: string },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visitors = await this.prisma.visitor.findMany({
      where: {
        resident: { flat: { societyId } },
        ...(opts?.approvalStatus ? { approvalStatus: opts.approvalStatus } : {}),
        ...(opts?.date === 'today' ? { createdAt: { gte: today } } : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return visitors.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      purpose: v.purpose,
      vehicleNumber: v.vehicleNo,
      status: v.status === 'EXPECTED' ? 'PENDING' : v.status,
      approvalStatus: v.approvalStatus,
      validFrom: v.validFrom,
      validTill: v.validUntil,
      qrToken: v.qrToken,
      checkedInAt: v.entryAt,
      checkedOutAt: v.exitAt,
      resident: {
        name: v.resident.user.name,
        unit: { flatNumber: v.resident.flat?.number, tower: v.resident.flat?.block },
      },
      createdAt: v.createdAt,
    }));
  }

  async approveVisitor(visitorId: string, societyId: string, approverUserId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }
    this.assertSameSociety(visitor, societyId);

    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: approverUserId,
        approvedAt: new Date(),
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  async rejectVisitor(visitorId: string, societyId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) {
      throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found' });
    }
    this.assertSameSociety(visitor, societyId);

    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { approvalStatus: 'REJECTED' },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  /**
   * Resident decision on a pending visitor (from the actionable push).
   *
   * Idempotent & race-safe: the state transition is an atomic conditional update
   * scoped to `approvalStatus = 'PENDING'`, so the FIRST decision wins. Duplicate
   * taps, the same resident on multiple devices, two family members, or FCM
   * at-least-once redelivery all collapse to a no-op that returns the decision
   * that actually took effect (`applied: false`). No row-level race.
   */
  async decide(
    visitorId: string,
    societyId: string,
    userId: string,
    action: 'APPROVE' | 'REJECT',
  ): Promise<{ decision: string; applied: boolean; visitor: unknown }> {
    // Ownership + society scoping (only the owning resident may decide).
    await this.findById(visitorId, societyId, userId);

    const target = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const res = await this.prisma.visitor.updateMany({
      where: { id: visitorId, approvalStatus: 'PENDING' },
      data: { approvalStatus: target, approvedById: userId, approvedAt: new Date() },
    });

    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { user: true, flat: true } } },
    });

    // applied=false => a prior decision already won; we return that decision.
    return { decision: visitor!.approvalStatus, applied: res.count > 0, visitor };
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
