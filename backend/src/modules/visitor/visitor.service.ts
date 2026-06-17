import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorStatus, VisitorType } from '@prisma/client';
import { CreateAtGateVisitorDto, CreateVisitorDto, CheckInVisitorDto } from './dto/visitor.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { randomBytes } from 'crypto';
import { VisitorGateway } from './visitor.gateway';
import { PushService } from '../../common/notification/push.service';

/**
 * Canonical India delivery partners shown to staff in the Add Entry form
 * picker. Kept here (not in a separate constants file) because this is the
 * service that enforces the value — keeping the list adjacent to its
 * validator means one PR to add a new courier. The mobile apps reuse this
 * list via a parallel TypeScript file (apps/staff-app/src/constants/
 * delivery-partners.ts) — keep them in sync.
 */
export const DELIVERY_PARTNERS: readonly string[] = [
  'Amazon',
  'Flipkart',
  'Swiggy',
  'Swiggy Instamart',
  'Zomato',
  'Blinkit',
  'Zepto',
  'BigBasket',
  'Dunzo',
  'Meesho',
  'BlueDart',
  'Delhivery',
  'DTDC',
  'Shadowfax',
  'Ecom Express',
  'Xpressbees',
  'India Post',
  'FedEx',
];

function isAllowedDeliveryPartner(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  if (DELIVERY_PARTNERS.includes(trimmed)) return true;
  // Free-text fallback the staff app emits when the partner isn't on the
  // list. Bounded length keeps the column safe.
  return trimmed.startsWith('Other: ') && trimmed.length <= 80;
}

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
   * Guard added a walk-in visitor — fire actionable push so the resident can
   * decide from the lockscreen. Two payload shapes:
   *
   *   GUEST    → category='visitors_gate', actionGroup='visitor_approval',
   *              2 buttons (Approve / Reject), data.type='VISITOR_APPROVAL_REQUEST'
   *   DELIVERY → category='deliveries',    actionGroup='delivery_approval',
   *              3 buttons (Approve / Leave at Security / Reject),
   *              data.type='DELIVERY_APPROVAL_REQUEST', data.deliveryPartner
   *
   * The decide() endpoint is idempotent — duplicate taps and multi-device fan-
   * out collapse safely. Best-effort: never blocks visitor creation.
   */
  private notifyResidentPendingApproval(visitor: {
    id: string;
    name: string;
    purpose?: string | null;
    photoUrl?: string | null;
    type: VisitorType;
    deliveryPartner?: string | null;
    resident?: { userId?: string | null } | null;
  }): void {
    try {
      const userId = visitor?.resident?.userId;
      if (!userId) return;

      const isDelivery = visitor.type === VisitorType.DELIVERY;
      const partner = visitor.deliveryPartner?.trim();
      const purpose = visitor.purpose?.trim();

      const title = isDelivery
        ? `${partner ?? 'Delivery'} at the gate`
        : 'Visitor at the gate';
      const body = isDelivery
        ? `${visitor.name} is at the gate with a delivery. What should we do?`
        : purpose
        ? `${visitor.name} (${purpose}) is at the gate. Approve entry?`
        : `${visitor.name} is at the gate. Approve entry?`;

      const actions = isDelivery
        ? [
            { id: 'APPROVE', title: 'Approve' },
            { id: 'LEAVE_AT_SECURITY', title: 'Leave at security' },
            { id: 'REJECT', title: 'Reject', destructive: true },
          ]
        : [
            { id: 'APPROVE', title: 'Approve' },
            { id: 'REJECT', title: 'Reject', destructive: true },
          ];

      void this.push
        .send(
          userId,
          {
            title,
            body,
            category: isDelivery ? 'deliveries' : 'visitors_gate',
            ...(visitor.photoUrl ? { imageUrl: visitor.photoUrl } : {}),
            collapseKey: `visitor:${visitor.id}`,
            actions,
            // Full-screen, screen-waking approval prompt on the resident's phone.
            fullScreen: true,
          },
          {
            type: isDelivery ? 'DELIVERY_APPROVAL_REQUEST' : 'VISITOR_APPROVAL_REQUEST',
            visitId: visitor.id,
            entityId: visitor.id,
            visitorName: visitor.name,
            actionGroup: isDelivery ? 'delivery_approval' : 'visitor_approval',
            ...(partner ? { deliveryPartner: partner } : {}),
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

  /**
   * Push back to the staff member who created the entry once the resident
   * makes a decision. Lets the guard see the outcome without polling. Quiet
   * category (no actions) — purely informational. Uses approval_results
   * which our 3-type taxonomy classifies as DELIVERY (lockscreen + heads-up).
   * Best-effort.
   */
  private notifyStaffOfDecision(
    staffUserId: string | null,
    visitor: { id: string; name: string; type: VisitorType; approvalStatus: string },
  ): void {
    if (!staffUserId) return;
    const outcome =
      visitor.approvalStatus === 'APPROVED'
        ? 'approved entry'
        : visitor.approvalStatus === 'LEFT_AT_SECURITY'
        ? 'asked to leave it at security'
        : 'rejected the entry';
    const label = visitor.type === VisitorType.DELIVERY ? 'delivery' : 'visitor';
    try {
      void this.push
        .send(
          staffUserId,
          {
            title: 'Resident decision',
            body: `Resident ${outcome} for ${label} "${visitor.name}".`,
            category: 'approval_results',
            collapseKey: `visitor-decision:${visitor.id}`,
          },
          {
            type: 'VISITOR_DECISION_RESULT',
            visitId: visitor.id,
            entityId: visitor.id,
            approvalStatus: visitor.approvalStatus,
          },
        )
        .catch(() => {
          /* best-effort */
        });
    } catch {
      /* never let a feedback push break the decide flow */
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
   * actionable push fires to the resident so they can Approve/Reject (guests)
   * or Approve / Leave at Security / Reject (deliveries) from the lockscreen.
   * Check-in is blocked until that decision lands.
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

    const type = dto.type === 'DELIVERY' ? VisitorType.DELIVERY : VisitorType.GUEST;

    // Delivery rows MUST carry a recognised partner — the resident notification
    // copy depends on it ("Amazon at the gate") and reporting later wants a
    // bounded set of values. Empty / unrecognised free-text rejected.
    let deliveryPartner: string | null = null;
    if (type === VisitorType.DELIVERY) {
      const partner = dto.deliveryPartner?.trim();
      if (!partner) {
        throw new BadRequestException({
          code: 'DELIVERY_PARTNER_REQUIRED',
          message: 'Select a delivery partner (or "Other: ...") for delivery entries.',
        });
      }
      if (!isAllowedDeliveryPartner(partner)) {
        throw new BadRequestException({
          code: 'DELIVERY_PARTNER_INVALID',
          message:
            'Delivery partner must be one of the known list or start with "Other: ".',
        });
      }
      deliveryPartner = partner;
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
        type,
        deliveryPartner,
        createdByStaffId: guardUserId,
        qrToken: randomBytes(4).toString('hex').toUpperCase(),
        validFrom,
        validUntil,
        status: VisitorStatus.EXPECTED,
        approvalStatus: 'PENDING',
      },
      include: { resident: { include: { user: true, flat: true } } },
    });

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
    action: 'APPROVE' | 'REJECT' | 'LEAVE_AT_SECURITY',
  ): Promise<{ decision: string; applied: boolean; visitor: unknown }> {
    // Ownership + society scoping (only the owning resident may decide).
    await this.findById(visitorId, societyId, userId);

    const target =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'LEAVE_AT_SECURITY'
        ? 'LEFT_AT_SECURITY'
        : 'REJECTED';

    const res = await this.prisma.visitor.updateMany({
      where: { id: visitorId, approvalStatus: 'PENDING' },
      data: { approvalStatus: target, approvedById: userId, approvedAt: new Date() },
    });

    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { user: true, flat: true } } },
    });

    // Fire-and-forget feedback push to the guard who created the entry, but
    // only on the request that actually transitioned the row — otherwise a
    // duplicate tap would re-notify them.
    if (res.count > 0 && visitor) {
      this.notifyStaffOfDecision(visitor.createdByStaffId, {
        id: visitor.id,
        name: visitor.name,
        type: visitor.type,
        approvalStatus: visitor.approvalStatus,
      });
    }

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
