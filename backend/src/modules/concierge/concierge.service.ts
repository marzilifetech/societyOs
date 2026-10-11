import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RateConciergeDto, normaliseConciergeType } from './dto/concierge.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';

@Injectable()
export class ConciergeService {
  private readonly logger = new Logger(ConciergeService.name);
  constructor(private prisma: PrismaService, private push: PushService) {}

  async createRequest(
    userId: string,
    societyId: string,
    dto: { type: string; description?: string; preferredTime?: string },
  ) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');

    const type = normaliseConciergeType(dto.type);
    const label = typeof dto.type === 'string' ? dto.type.trim() : '';
    // Keep the original label when it did not map cleanly, so the desk still
    // knows the resident asked for e.g. "Heavy Lifting" and not just "OTHER".
    const parts = [dto.description?.trim(), type === 'OTHER' && label && label.toUpperCase() !== 'OTHER' ? `Category: ${label}` : '', dto.preferredTime?.trim() ? `Preferred: ${dto.preferredTime.trim()}` : ''].filter(Boolean);

    const created = await this.prisma.conciergeRequest.create({
      data: {
        societyId,
        residentId: resident.id,
        type,
        description: parts.join(' \u2014 ') || label || 'Assistance requested',
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
    void this.notifyStaffOfNewRequest(created).catch((e) =>
      this.logger.warn(`help request staff push failed id=${created.id}: ${(e as Error).message}`),
    );
    return created;
  }

  /**
   * Tell staff a resident needs help, with Accept / Decline on the
   * notification. Nothing was sent before — requests waited, unseen, until
   * someone happened to open the admin portal.
   *
   * Who: active staff of the society, preferring everyone who is NOT on gate
   * duty (guards can't leave the gate to carry a parcel); if the society only
   * has security staff, they get it. First to accept takes it (see
   * StaffHelpService.accept).
   */
  private async notifyStaffOfNewRequest(req: {
    id: string;
    societyId: string;
    type: string;
    description: string;
    resident?: { user?: { name: string | null } | null; flat?: { block: string; number: string } | null } | null;
  }) {
    const staff = await this.prisma.staffMember.findMany({
      where: {
        societyId: req.societyId,
        deletedAt: null,
        user: { status: { notIn: ['INACTIVE', 'SUSPENDED', 'REJECTED'] } },
      },
      select: { userId: true, department: true, categories: true },
    });
    const isSecurity = (s: { department: string | null; categories: string[] }) =>
      s.department?.toUpperCase() === 'SECURITY' || s.categories.some((c) => c.toUpperCase() === 'SECURITY');
    const helpers = staff.filter((s) => !isSecurity(s));
    const recipients = (helpers.length ? helpers : staff).map((s) => s.userId);
    if (!recipients.length) return;

    const flat = req.resident?.flat ? `${req.resident.flat.block}-${req.resident.flat.number}` : null;
    const who = [req.resident?.user?.name, flat ? `Flat ${flat}` : null].filter(Boolean).join(', ');
    const notification = {
      title: 'Resident needs help',
      body: `${who ? `${who}: ` : ''}${req.description}`.slice(0, 300),
      category: 'staff_help_requests',
      collapseKey: `help:${req.id}`,
      actions: [
        { id: 'ACCEPT', title: 'Accept' },
        { id: 'DECLINE', title: 'Decline', destructive: true },
      ],
    };
    const data = {
      type: 'HELP_REQUEST',
      entityId: req.id,
      requestId: req.id,
      actionGroup: 'help_request',
    };
    await Promise.allSettled(recipients.map((userId) => this.push.send(userId, notification, data)));
  }

  async getMyRequests(userId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) return [];
    const rows = await this.prisma.conciergeRequest.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
    return this.withStaffNames(rows);
  }

  /**
   * Adds what the resident's screens show: who is helping (`staffName`) and
   * the preferred time, which is stored inside the description as
   * "Preferred: …". Both always read "Not specified / Not assigned" before.
   */
  private async withStaffNames<T extends { assignedStaffId: string | null; description: string | null }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.assignedStaffId).filter((x): x is string => !!x))];
    const staff = ids.length
      ? await this.prisma.staffMember.findMany({
          where: { id: { in: ids } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const nameById = new Map(staff.map((s) => [s.id, s.user?.name ?? null]));
    return rows.map((r) => ({
      ...r,
      staffName: r.assignedStaffId ? nameById.get(r.assignedStaffId) ?? null : null,
      preferredTime: /(?:^|\n|\s)Preferred: ([^\n]+)/.exec(r.description ?? '')?.[1]?.trim() ?? null,
    }));
  }

  async cancelRequest(userId: string, id: string, societyId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    const req = await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    if (req.residentId !== resident?.id) throw new ForbiddenException();
    if (req.status !== 'PENDING') throw new ForbiddenException('Cannot cancel non-pending request');
    return this.prisma.conciergeRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async getAll(societyId: string, status?: string) {
    return this.prisma.conciergeRequest.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, societyId: string, status: string, note?: string) {
    await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    const updated = await this.prisma.conciergeRequest.update({
      where: { id },
      data: { status: status as any, ...(note ? { note } : {}) },
      include: { resident: { select: { userId: true } } },
    });

    const type = String(status) === 'COMPLETED' ? 'CONCIERGE_COMPLETED' : 'CONCIERGE_UPDATED';
    const body =
      String(status) === 'COMPLETED'
        ? 'Your concierge request has been completed.'
        : `Your concierge request is now ${String(status).replace(/_/g, ' ').toLowerCase()}.`;
    const userId = updated.resident?.userId;
    if (userId) {
      void this.push
        .send(
          userId,
          { title: 'Concierge update', body, category: 'daily_help', collapseKey: `concierge:${id}` },
          { type, entityId: id, requestId: id, status: String(status) },
        )
        .catch((e) => this.logger.warn(`concierge push failed id=${id}: ${(e as Error).message}`));
    }

    return updated;
  }

  async getMyRequest(userId: string, id: string, societyId: string) {
    const resident = await this.prisma.resident.findFirst({ where: { user: { id: userId } } });
    if (!resident) throw new NotFoundException('Resident not found');
    const req = await requireOwnedById(
      () => this.prisma.conciergeRequest.findUnique({ where: { id } }),
      societyId,
      'Request',
    );
    if (req.residentId !== resident.id) throw new NotFoundException('Request not found');
    const [withNames] = await this.withStaffNames([req]);
    return withNames;
  }

  async rateRequest(userId: string, id: string, societyId: string, dto: RateConciergeDto) {
    const req = await this.getMyRequest(userId, id, societyId);
    if (req.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate completed requests');
    }
    if (req.rating !== null) {
      throw new BadRequestException('Request has already been rated');
    }
    return this.prisma.conciergeRequest.update({
      where: { id },
      data: { rating: dto.rating, ratingText: dto.review ?? dto.comment ?? null },
    });
  }
}
