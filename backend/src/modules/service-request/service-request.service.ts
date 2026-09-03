import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceRequestStatus, ServicePhase } from '@prisma/client';
import {
  CreateServiceRequestDto,
  AdminCreateServiceRequestDto,
  AdminUpdateServiceRequestDto,
  UpdateServiceRequestStatusDto,
  RateServiceRequestDto,
} from './dto/service-request.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { toCsvRow } from '../../common/utils/csv.util';
import { formatIst } from '../../common/utils/ist-time.util';
import { SERVICE_REQUEST_TRANSITIONS } from './service-request.transitions';
import { S3Service } from '../../common/storage/s3.service';
import { ServiceRequestGateway } from './service-request.gateway';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';

const SOCIETY_MISMATCH = { code: 'SERVICE_REQUEST_SOCIETY_MISMATCH', message: 'Service request belongs to another society' };

@Injectable()
export class ServiceRequestService {
  private readonly logger = new Logger(ServiceRequestService.name);
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private serviceRequestGateway: ServiceRequestGateway,
    private notificationService: NotificationService,
    private push: PushService,
  ) {}

  private async findOneRaw(id: string) {
    return this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        resident: { include: { user: true, flat: true } },
        photos: true,
      },
    });
  }

  private async enrichWithAssignedStaff<T extends { assignedToIds?: string[] }>(req: T) {
    const ids = req.assignedToIds ?? [];
    if (!ids.length) return { ...req, assignedTo: null, assignedStaff: [] };
    const staff = await this.prisma.staffMember.findMany({
      where: { id: { in: ids } },
      include: { user: true },
    });
    const byId = new Map(staff.map((s) => [s.id, s]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    return { ...req, assignedTo: ordered[0] ?? null, assignedStaff: ordered };
  }

  private async enrichManyWithAssignedStaff<T extends { assignedToIds?: string[] }>(rows: T[]) {
    const allIds = [...new Set(rows.flatMap((r) => r.assignedToIds ?? []))];
    if (!allIds.length) return rows.map((r) => ({ ...r, assignedTo: null, assignedStaff: [] }));
    const staff = await this.prisma.staffMember.findMany({
      where: { id: { in: allIds } },
      include: { user: true },
    });
    const byId = new Map(staff.map((s) => [s.id, s]));
    return rows.map((r) => {
      const ordered = (r.assignedToIds ?? []).map((id) => byId.get(id)).filter(Boolean);
      return { ...r, assignedTo: ordered[0] ?? null, assignedStaff: ordered };
    });
  }

  private async resolveStaffId(userId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.id;
  }

  private assertSocietyMatch(societyId: string | undefined, reqSocietyId: string) {
    if (!societyId || societyId !== reqSocietyId) {
      throw new ForbiddenException(SOCIETY_MISMATCH);
    }
  }

  private normalizePhotoPhase(phase: string): ServicePhase {
    if (phase === 'DISPUTE') return ServicePhase.DURING;
    return phase as ServicePhase;
  }

  private assertStaffCanAccessTask(
    sr: { societyId: string; assignedToIds: string[]; status: ServiceRequestStatus },
    staffId: string,
    jwtSocietyId: string,
  ) {
    this.assertSocietyMatch(sr.societyId, jwtSocietyId);
    if (!sr.assignedToIds?.length) {
      throw new ForbiddenException({ code: 'NOT_ASSIGNED_STAFF', message: 'Task is not assigned to a staff member' });
    }
    if (!sr.assignedToIds.includes(staffId)) {
      throw new ForbiddenException({ code: 'NOT_ASSIGNED_STAFF', message: 'Not assigned to you' });
    }
  }

  async create(userId: string, societyId: string, dto: CreateServiceRequestDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const flat = await this.prisma.flat.findUnique({ where: { id: resident.flatId } });
    if (!flat || flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'RESIDENT_SOCIETY_MISMATCH',
        message: 'Resident does not belong to this society',
      });
    }

    const slaDeadline = await this.computeSlaDeadline(societyId, dto.category);

    const created = await this.prisma.serviceRequest.create({
      data: { residentId: resident.id, societyId, ...dto, ...(slaDeadline && { slaDeadline }) },
      include: { photos: true },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Request logged',
          body: `We've logged your ${created.category} request.`,
          category: 'complaints',
          collapseKey: `service-request:${created.id}`,
        },
        { type: 'SERVICE_REQUEST_CREATED', entityId: created.id, serviceRequestId: created.id },
      )
      .catch((e) => this.logger.warn(`push failed: ${e?.message ?? e}`));

    return this.enrichWithAssignedStaff(created);
  }

  private async computeSlaDeadline(societyId: string, category: string): Promise<Date | null> {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) return null;
    const cfg = (typeof society.config === 'object' && society.config && !Array.isArray(society.config))
      ? (society.config as Record<string, unknown>)
      : {};
    const slaConfig = cfg.slaConfig as Record<string, number> | undefined;
    if (!slaConfig) return null;
    const hours = slaConfig[category] ?? slaConfig['DEFAULT'];
    if (!hours || typeof hours !== 'number') return null;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    return deadline;
  }

  async findByResident(userId: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const flat = await this.prisma.flat.findUnique({ where: { id: resident.flatId } });
    if (!flat || flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'RESIDENT_SOCIETY_MISMATCH',
        message: 'Resident does not belong to this society',
      });
    }

    const rows = await this.prisma.serviceRequest.findMany({
      where: { residentId: resident.id, societyId, deletedAt: null },
      include: { photos: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichManyWithAssignedStaff(rows);
  }

  /** Resident cancels their own (not-yet-completed) request. Maps to CLOSED. */
  async cancelByResident(userId: string, societyId: string, id: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Service request not found');
    if (existing.residentId !== resident.id || existing.societyId !== societyId) {
      throw new ForbiddenException({ code: 'NOT_OWNER', message: 'Not your request' });
    }
    if (
      existing.status === ServiceRequestStatus.COMPLETED ||
      existing.status === ServiceRequestStatus.CANCELLED
    ) {
      return this.enrichWithAssignedStaff(existing);
    }
    return this.enrichWithAssignedStaff(
      await this.prisma.serviceRequest.update({
        where: { id },
        data: { status: ServiceRequestStatus.CANCELLED },
        include: { photos: true },
      }),
    );
  }

  async adminCreate(societyId: string, dto: AdminCreateServiceRequestDto) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: dto.residentId, flat: { societyId } },
      include: { flat: true },
    });
    if (!resident) throw new NotFoundException('Resident not found in this society');

    const slaDeadline = await this.computeSlaDeadline(societyId, dto.category);
    return this.enrichWithAssignedStaff(
      await this.prisma.serviceRequest.create({
        data: {
          societyId,
          residentId: dto.residentId,
          category: dto.category,
          description: dto.description,
          ...(dto.scheduledTime && { scheduledTime: new Date(dto.scheduledTime) }),
          ...(dto.tags && { tags: dto.tags }),
          ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
          ...(dto.reminderMinutes !== undefined && { reminderMinutes: dto.reminderMinutes }),
          ...(slaDeadline && { slaDeadline }),
        },
        include: {
          resident: { include: { user: true, flat: true } },
        },
      }),
    );
  }

  async adminUpdate(id: string, societyId: string, dto: AdminUpdateServiceRequestDto) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);

    const data: Record<string, unknown> = {};
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.scheduledTime !== undefined) data.scheduledTime = dto.scheduledTime ? new Date(dto.scheduledTime) : null;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.isPaid !== undefined) data.isPaid = dto.isPaid;
    if (dto.reminderMinutes !== undefined) {
      data.reminderMinutes = dto.reminderMinutes;
      data.reminderSentAt = null;
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: data as any,
      include: { resident: { include: { user: true, flat: true } }, photos: true },
    });
    return this.enrichWithAssignedStaff(updated);
  }

  async updateTags(id: string, societyId: string, tags: string[]) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);
    return this.prisma.serviceRequest.update({ where: { id }, data: { tags } });
  }

  async softDelete(id: string, societyId: string) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);
    return this.prisma.serviceRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findBySociety(societyId: string, status?: ServiceRequestStatus, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length
      ? { resident: { flat: { block: { in: managedBlocks } } } }
      : {};
    const rows = await this.prisma.serviceRequest.findMany({
      where: { societyId, deletedAt: null, ...(status && { status }), ...blockWhere },
      include: {
        resident: { include: { user: true, flat: true } },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichManyWithAssignedStaff(rows);
  }

  /**
   * Complete CSV export of service requests.
   *
   * The dashboard used to build this in the browser from `displayRequests` —
   * i.e. only the rows currently loaded AND currently filtered, with 10 columns
   * that omitted the description, the assigned staff, every timestamp past
   * creation, and the resolution. That is the "Export CSV is incomplete"
   * report. Exporting server-side means the file covers the full result set for
   * the chosen filters and carries the whole record.
   *
   * All timestamps are rendered in IST so the CSV matches what the operator
   * saw on screen (see `formatIst`).
   */
  async exportCsv(
    societyId: string,
    opts: { status?: ServiceRequestStatus; from?: string; to?: string; managedBlocks?: string[] } = {},
  ): Promise<string> {
    const blockWhere = opts.managedBlocks?.length
      ? { resident: { flat: { block: { in: opts.managedBlocks } } } }
      : {};
    const createdAt: Record<string, Date> = {};
    if (opts.from) {
      const d = new Date(opts.from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }

    const rows = await this.prisma.serviceRequest.findMany({
      where: {
        societyId,
        deletedAt: null,
        ...(opts.status ? { status: opts.status } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...blockWhere,
      },
      include: {
        resident: { include: { user: true, flat: true } },
        photos: true,
        notes: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve assignee names in one query rather than per row.
    const staffIds = [...new Set(rows.flatMap((r) => r.assignedToIds))];
    const staff = staffIds.length
      ? await this.prisma.staffMember.findMany({
          where: { id: { in: staffIds } },
          include: { user: { select: { name: true } } },
        })
      : [];
    const staffNameById = new Map(staff.map((sm) => [sm.id, sm.user?.name ?? sm.designation]));

    const header = [
      'ID', 'Created At (IST)', 'Category', 'Status', 'Description',
      'Resident', 'Phone', 'Unit', 'Block',
      'Assigned To', 'Preferred Time', 'Scheduled (IST)', 'SLA Deadline (IST)',
      'Accepted At (IST)', 'Resolved At (IST)', 'Confirmed At (IST)',
      'Age (hours)', 'Resolution Time (hours)',
      'Paid', 'Auto Assigned', 'Tags', 'Photos', 'Rating', 'Rating Note',
      'Admin Note', 'Dispute Reason', 'Latest Note',
    ];

    const now = Date.now();
    const lines = rows.map((r) => {
      const ageHours = (now - r.createdAt.getTime()) / 3_600_000;
      const resolutionHours =
        r.resolvedAt != null ? (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000 : null;
      return toCsvRow([
        r.id,
        formatIst(r.createdAt),
        r.category,
        r.status,
        r.description ?? '',
        r.resident?.user?.name ?? '',
        r.resident?.user?.phone ?? '',
        r.resident?.flat?.number ?? '',
        r.resident?.flat?.block ?? '',
        r.assignedToIds.map((id) => staffNameById.get(id) ?? id).join('; '),
        r.preferredTime ?? '',
        formatIst(r.scheduledTime),
        formatIst(r.slaDeadline),
        formatIst(r.acceptedAt),
        formatIst(r.resolvedAt),
        formatIst(r.confirmedAt),
        ageHours.toFixed(1),
        resolutionHours != null ? resolutionHours.toFixed(1) : '',
        r.isPaid ? 'Paid' : 'Free',
        r.autoAssigned ? 'Yes' : 'No',
        (r.tags ?? []).join('; '),
        String(r.photos?.length ?? 0),
        r.rating != null ? Number(r.rating).toFixed(1) : '',
        r.ratingText ?? r.ratingNote ?? '',
        r.adminNote ?? '',
        r.disputeReason ?? '',
        r.notes?.length ? r.notes[r.notes.length - 1].body ?? '' : '',
      ]);
    });

    return [toCsvRow(header), ...lines].join('\n') + '\n';
  }

  async findByStaff(userId: string, societyId: string) {
    const staffId = await this.resolveStaffId(userId);
    const staff = await this.prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || staff.societyId !== societyId) {
      throw new ForbiddenException({ code: 'STAFF_SOCIETY_MISMATCH', message: 'Staff profile society mismatch' });
    }

    const rows = await this.prisma.serviceRequest.findMany({
      where: { assignedToIds: { has: staffId }, societyId, deletedAt: null },
      include: {
        resident: { include: { user: true, flat: true } },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichManyWithAssignedStaff(rows);
  }

  async findOne(id: string, opts?: { residentUserId?: string; societyId?: string }) {
    const req = await this.findOneRaw(id);
    if (!req || req.deletedAt) throw new NotFoundException('Service request not found');

    if (opts?.residentUserId) {
      const resident = await requireResidentByUserId(this.prisma, opts.residentUserId);
      if (req.residentId !== resident.id) {
        throw new ForbiddenException('Service request does not belong to this resident');
      }
    }

    if (opts?.societyId !== undefined) {
      this.assertSocietyMatch(req.societyId, opts.societyId);
    }

    return this.enrichWithAssignedStaff(req);
  }

  async updateStatus(id: string, societyId: string, dto: UpdateServiceRequestStatusDto) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);

    const assignedIds =
      dto.assignedToIds ??
      (dto.assignedToId !== undefined ? (dto.assignedToId ? [dto.assignedToId] : []) : undefined);

    const current = existing.status;
    const next = dto.status;

    if (next === ServiceRequestStatus.REJECTED && (!dto.reason || !dto.reason.trim())) {
      throw new BadRequestException({
        code: 'REJECT_REASON_REQUIRED',
        message: 'reason is required when rejecting a service request',
      });
    }

    if (current === next) {
      return this.prisma.serviceRequest.update({
        where: { id },
        data: {
          ...(assignedIds !== undefined && { assignedToIds: assignedIds }),
          ...(dto.adminNote !== undefined && { adminNote: dto.adminNote }),
        },
      });
    }

    const allowed = SERVICE_REQUEST_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Cannot move service request from ${current} to ${next}`,
        from: current,
        to: next,
        allowedNext: allowed,
      });
    }

    const data: Record<string, unknown> = {
      status: next,
      ...(assignedIds !== undefined && { assignedToIds: assignedIds }),
      ...(dto.adminNote !== undefined && { adminNote: dto.adminNote }),
    };

    if (next === ServiceRequestStatus.REJECTED) {
      data.rejectedReason = dto.reason!.trim();
    } else if (next !== current) {
      data.rejectedReason = null;
    }

    if (next === ServiceRequestStatus.COMPLETED) {
      data.resolvedAt = new Date();
    } else if (current === ServiceRequestStatus.COMPLETED) {
      data.resolvedAt = null;
    }

    if (next === ServiceRequestStatus.IN_PROGRESS && !existing.acceptedAt) {
      data.acceptedAt = new Date();
    }

    const result = await this.prisma.serviceRequest.update({
      where: { id },
      data: data as any,
    });

    if (next === ServiceRequestStatus.COMPLETED) {
      this.notifyCompleted(result.id, result.category);
    }

    return result;
  }

  /**
   * COMPLETED is the state in which the resident is asked to rate/confirm
   * (see rate / confirmCompletion). We send a single completion push that
   * doubles as the rate prompt. Fire-and-forget.
   */
  private notifyCompleted(requestId: string, category: string): void {
    void this.pushResident(
      requestId,
      {
        title: 'Request completed',
        body: `Your ${category} request is complete.`,
        category: 'complaints',
      },
      { type: 'SERVICE_REQUEST_COMPLETED', entityId: requestId, serviceRequestId: requestId },
    );
    void this.pushResident(
      requestId,
      {
        title: 'Rate your request',
        body: `Please rate your completed ${category} request.`,
        category: 'complaints',
      },
      { type: 'SERVICE_REQUEST_RATE', entityId: requestId, serviceRequestId: requestId },
    );
  }

  private async countActiveAssignments(staffMemberId: string): Promise<number> {
    return this.prisma.serviceRequest.count({
      where: {
        assignedToIds: { has: staffMemberId },
        status: { in: [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.IN_PROGRESS] },
        deletedAt: null,
      },
    });
  }

  /** Best-effort push to the request's resident. Never awaits, never throws. */
  private async pushResident(
    requestId: string,
    notification: { title: string; body: string; category: string },
    data: Record<string, string>,
  ): Promise<void> {
    try {
      const req = await this.prisma.serviceRequest.findUnique({
        where: { id: requestId },
        include: { resident: { include: { user: true } } },
      });
      const userId = req?.resident?.userId;
      if (!userId) return;
      void this.push
        .send(userId, { ...notification, collapseKey: `service-request:${requestId}` }, data)
        .catch((e) => this.logger.warn(`push failed: ${e?.message ?? e}`));
    } catch (e: any) {
      this.logger.warn(`push failed: ${e?.message ?? e}`);
    }
  }

  /** Best-effort task push to assigned staff members. Never awaits, never throws. */
  private async pushAssignedStaff(staffMemberIds: string[], category: string, requestId: string): Promise<void> {
    if (!staffMemberIds.length) return;
    try {
      const staff = await this.prisma.staffMember.findMany({ where: { id: { in: staffMemberIds } } });
      for (const s of staff) {
        if (!s.userId) continue;
        void this.push
          .send(
            s.userId,
            {
              title: 'New task assigned',
              body: `New task assigned: ${category}`,
              category: 'staff_tasks',
              collapseKey: `service-request:${requestId}`,
            },
            { type: 'TASK_ASSIGNED', entityId: requestId, serviceRequestId: requestId },
          )
          .catch((e) => this.logger.warn(`push failed: ${e?.message ?? e}`));
      }
    } catch (e: any) {
      this.logger.warn(`push failed: ${e?.message ?? e}`);
    }
  }

  private emitAssignedToStaff(staffIds: string[], payload: { taskId: string; title: string; address: string; urgency: string | null }) {
    const assignedAt = new Date().toISOString();
    for (const staffId of staffIds) {
      this.serviceRequestGateway.emitTaskAssigned(staffId, { ...payload, assignedAt });
    }
  }

  async assignStaff(id: string, societyId: string, staffMemberIds: string[]) {
    if (!staffMemberIds.length) {
      throw new BadRequestException({ code: 'NO_STAFF', message: 'At least one staff member is required' });
    }

    const staffMembers = await this.prisma.staffMember.findMany({
      where: { id: { in: staffMemberIds }, societyId, deletedAt: null },
    });
    if (staffMembers.length !== staffMemberIds.length) {
      throw new BadRequestException({
        code: 'STAFF_NOT_IN_SOCIETY',
        message: 'One or more staff members were not found in this society',
      });
    }

    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);

    for (const staffMemberId of staffMemberIds) {
      const activeCount = await this.countActiveAssignments(staffMemberId);
      if (activeCount >= 3) {
        throw new ConflictException({
          code: 'STAFF_OVERLOADED',
          message: 'Staff member already has 3 or more active assignments. Please choose another staff member.',
        });
      }
    }

    if (existing.status === ServiceRequestStatus.COMPLETED || existing.status === ServiceRequestStatus.CLOSED) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Cannot assign when status is ${existing.status}`,
        from: existing.status,
        to: ServiceRequestStatus.ASSIGNED,
        allowedNext: [],
      });
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedToIds: staffMemberIds,
        status: ServiceRequestStatus.ASSIGNED,
        rejectedReason: null,
      },
    });

    this.emitAssignedToStaff(staffMemberIds, {
      taskId: updated.id,
      title: updated.category,
      address: updated.description,
      urgency: null,
    });

    void this.pushResident(
      updated.id,
      {
        title: 'Request assigned',
        body: `Your ${updated.category} request has been assigned.`,
        category: 'complaints',
      },
      { type: 'SERVICE_REQUEST_ASSIGNED', entityId: updated.id, serviceRequestId: updated.id },
    );
    void this.pushAssignedStaff(staffMemberIds, updated.category, updated.id);

    return this.enrichWithAssignedStaff(updated);
  }

  async rate(id: string, userId: string, societyId: string, dto: RateServiceRequestDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.findOne(id, { residentUserId: userId, societyId });

    const flat = await this.prisma.flat.findUnique({ where: { id: resident.flatId } });
    if (!flat || flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'RESIDENT_SOCIETY_MISMATCH', message: 'Resident does not belong to this society' });
    }

    if (req.status !== ServiceRequestStatus.COMPLETED) {
      throw new ForbiddenException({ code: 'NOT_COMPLETED', message: 'Can only rate completed requests' });
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        rating: dto.rating,
        ratingNote: dto.note,
        ratedAt: new Date(),
      },
    });
  }

  async confirmCompletion(id: string, userId: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(req.societyId, societyId);
    if (req.status !== ServiceRequestStatus.COMPLETED) {
      throw new BadRequestException({ code: 'NOT_COMPLETED', message: 'Request is not in COMPLETED state' });
    }
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status: ServiceRequestStatus.CLOSED, confirmedAt: new Date() },
    });
  }

  async raiseDispute(id: string, userId: string, societyId: string, reason: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(req.societyId, societyId);
    if (req.status !== ServiceRequestStatus.COMPLETED) {
      throw new BadRequestException({ code: 'NOT_COMPLETED', message: 'Can only dispute completed requests' });
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status: ServiceRequestStatus.IN_PROGRESS, disputeReason: reason, resolvedAt: null },
    });
    if (updated.assignedToIds?.length) {
      this.emitAssignedToStaff(updated.assignedToIds, {
        taskId: updated.id,
        title: `DISPUTE: ${updated.category}`,
        address: reason,
        urgency: 'HIGH',
      });
    }
    return updated;
  }

  async autoAssign(id: string, societyId: string, scheduledTime?: string) {
    const req = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(req.societyId, societyId);
    if (req.status !== ServiceRequestStatus.PENDING) {
      throw new BadRequestException({ code: 'NOT_PENDING', message: 'Only PENDING requests can be auto-assigned' });
    }

    const categoryKey = req.category.toUpperCase();
    const allStaff = await this.prisma.staffMember.findMany({ where: { societyId, deletedAt: null } });
    if (!allStaff.length) throw new BadRequestException({ code: 'NO_STAFF', message: 'No active staff available' });

    const categoryMatched = allStaff.filter((s) =>
      s.categories.some((c) => c.toUpperCase() === categoryKey || c.toUpperCase() === req.category.toUpperCase()),
    );
    const pool = categoryMatched.length ? categoryMatched : allStaff;

    const counts = await Promise.all(
      pool.map(async (s) => ({
        staff: s,
        count: await this.countActiveAssignments(s.id),
      })),
    );

    const eligible = counts.filter((c) => c.count < 3).sort((a, b) => a.count - b.count);
    if (!eligible.length) {
      throw new ConflictException({ code: 'ALL_STAFF_OVERLOADED', message: 'All staff are at capacity (3 active tasks)' });
    }

    const chosen = eligible[0].staff;
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedToIds: [chosen.id],
        status: ServiceRequestStatus.ASSIGNED,
        autoAssigned: true,
        ...(scheduledTime ? { scheduledTime: new Date(scheduledTime) } : {}),
        rejectedReason: null,
      },
    });

    this.emitAssignedToStaff([chosen.id], {
      taskId: updated.id,
      title: updated.category,
      address: updated.description,
      urgency: null,
    });

    void this.pushResident(
      updated.id,
      {
        title: 'Request assigned',
        body: `Your ${updated.category} request has been assigned.`,
        category: 'complaints',
      },
      { type: 'SERVICE_REQUEST_ASSIGNED', entityId: updated.id, serviceRequestId: updated.id },
    );
    void this.pushAssignedStaff([chosen.id], updated.category, updated.id);

    return this.enrichWithAssignedStaff(updated);
  }

  async assignStaffWithSchedule(
    id: string,
    societyId: string,
    staffMemberIds: string[],
    scheduledTime?: string,
  ) {
    const updated = await this.assignStaff(id, societyId, staffMemberIds);
    if (scheduledTime) {
      const withSchedule = await this.prisma.serviceRequest.update({
        where: { id },
        data: { scheduledTime: new Date(scheduledTime) },
      });
      return this.enrichWithAssignedStaff(withSchedule);
    }
    return updated;
  }

  /** Sends push reminders for scheduled requests whose reminder window has arrived. */
  async sendDueReminders() {
    const now = new Date();
    const candidates = await this.prisma.serviceRequest.findMany({
      where: {
        deletedAt: null,
        reminderSentAt: null,
        scheduledTime: { not: null },
        reminderMinutes: { not: null },
        status: { in: [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.IN_PROGRESS] },
      },
      include: { resident: { include: { user: true } } },
    });

    for (const req of candidates) {
      if (!req.scheduledTime || req.reminderMinutes == null) continue;
      const remindAt = new Date(req.scheduledTime.getTime() - req.reminderMinutes * 60_000);
      if (now < remindAt) continue;

      const residentUserId = req.resident.userId;
      await this.notificationService.notifyUser(
        residentUserId,
        'Service visit reminder',
        `Your ${req.category} service is scheduled at ${req.scheduledTime.toLocaleString('en-IN')}`,
        { category: 'SERVICE_REQUEST', data: { serviceRequestId: req.id } },
      );

      // Batch-load all assignees in one query instead of N findUniques. The
      // assignees must belong to the same society as the request — the tenant
      // extension scopes the findMany automatically, but we double-belt with
      // an explicit societyId filter to be safe.
      if (req.assignedToIds.length > 0) {
        const staffMembers = await this.prisma.staffMember.findMany({
          where: { id: { in: req.assignedToIds }, societyId: req.societyId },
        });
        const staffById = new Map(staffMembers.map((s) => [s.id, s]));
        for (const staffId of req.assignedToIds) {
          const staff = staffById.get(staffId);
          if (staff) {
            await this.notificationService.notifyUser(
              staff.userId,
              'Upcoming service task',
              `${req.category} at ${req.scheduledTime.toLocaleString('en-IN')}`,
              { category: 'SERVICE_REQUEST', data: { serviceRequestId: req.id } },
            );
          }
        }
      }

      await this.prisma.serviceRequest.update({
        where: { id: req.id },
        data: { reminderSentAt: now },
      });
    }
  }

  async getPhotoUploadUrl(
    requestId: string,
    userId: string,
    societyId: string,
    phase: string,
    contentType?: string,
  ) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    const slug = phase.toLowerCase();
    const presigned = await this.s3.getPresignedUploadUrl(
      `service-requests/${requestId}/${slug}`,
      contentType ?? 'image/jpeg',
    );
    return { url: presigned.uploadUrl, key: presigned.key, publicUrl: presigned.publicUrl };
  }

  async getVoiceUploadUrl(requestId: string, userId: string, societyId: string, contentType?: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    const presigned = await this.s3.getPresignedUploadUrl(
      `service-requests/${requestId}/voice`,
      contentType ?? 'audio/m4a',
    );
    return { url: presigned.uploadUrl, key: presigned.key, publicUrl: presigned.publicUrl };
  }

  async confirmPhoto(
    requestId: string,
    userId: string,
    societyId: string,
    key: string,
    phase: string,
    lat?: number,
    lng?: number,
    takenAt?: string,
  ) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    const dbPhase = this.normalizePhotoPhase(phase);
    return this.prisma.servicePhoto.create({
      data: {
        serviceRequestId: requestId,
        phase: dbPhase,
        url: this.s3.getPublicUrl(key),
        lat,
        lng,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
      },
    });
  }

  async addTaskNote(requestId: string, userId: string, societyId: string, body: string, voiceUrl?: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    return this.prisma.taskNote.create({
      data: {
        serviceRequestId: requestId,
        staffId,
        body,
        voiceUrl: voiceUrl ? this.s3.getPublicUrl(voiceUrl) : undefined,
      },
    });
  }

  async completeWork(requestId: string, userId: string, societyId: string, photoUrls: string[], notes?: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    if (sr.status !== ServiceRequestStatus.IN_PROGRESS) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Complete flow requires IN_PROGRESS; current status is ${sr.status}`,
        from: sr.status,
        to: ServiceRequestStatus.COMPLETED,
        allowedNext: SERVICE_REQUEST_TRANSITIONS[sr.status] ?? [],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const key of photoUrls) {
        await tx.servicePhoto.create({
          data: {
            serviceRequestId: requestId,
            phase: ServicePhase.AFTER,
            url: this.s3.getPublicUrl(key),
            takenAt: new Date(),
          },
        });
      }

      const data: Record<string, unknown> = {
        status: ServiceRequestStatus.COMPLETED,
        resolvedAt: new Date(),
      };
      if (notes?.trim()) {
        const line = `[Complete] ${notes.trim()}`;
        data.adminNote = sr.adminNote ? `${sr.adminNote}\n\n${line}` : line;
      }

      await tx.serviceRequest.update({
        where: { id: requestId },
        data: data as any,
      });
    });

    this.notifyCompleted(requestId, sr.category);

    return this.findOne(requestId, { societyId });
  }

  async proof(requestId: string, userId: string, societyId: string, photoKey: string) {
    return this.confirmPhoto(requestId, userId, societyId, photoKey, 'BEFORE');
  }

  async disputeResponse(requestId: string, userId: string, societyId: string, response: string, photoUrls: string[] = []) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(sr.societyId, societyId);
    this.assertStaffCanAccessTask(sr, staffId, societyId);

    await this.prisma.$transaction(async (tx) => {
      for (const key of photoUrls) {
        await tx.servicePhoto.create({
          data: {
            serviceRequestId: requestId,
            phase: ServicePhase.DURING,
            url: this.s3.getPublicUrl(key),
            takenAt: new Date(),
          },
        });
      }

      const note = `[Dispute response] ${response.trim()}`;
      const adminNote = sr.adminNote ? `${sr.adminNote}\n\n${note}` : note;

      await tx.serviceRequest.update({
        where: { id: requestId },
        data: { adminNote },
      });
    });

    return this.findOne(requestId, { societyId });
  }

  async addPhoto(serviceRequestId: string, phase: 'BEFORE' | 'DURING' | 'AFTER', url: string, lat?: number, lng?: number) {
    return this.prisma.servicePhoto.create({
      data: { serviceRequestId, phase, url, lat, lng },
    });
  }
}
