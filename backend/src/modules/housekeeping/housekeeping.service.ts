import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';
import { CreateHousekeepingDto } from './dto/create-housekeeping.dto';
import { RateHousekeepingDto } from './dto/rate-housekeeping.dto';
import { UpdateHousekeepingStatusDto } from './dto/update-housekeeping-status.dto';
import { RESIDENT_BRIEF } from '../../common/prisma-selects';

@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);
  constructor(private prisma: PrismaService, private s3: S3Service, private push: PushService) {}

  async getPhotoUploadUrl(id: string, societyId: string, phase?: string, contentType?: string) {
    // Cross-tenant guard: only mint upload URLs for requests in the caller's society.
    await requireOwnedById(
      () => this.prisma.housekeepingRequest.findUnique({ where: { id } }),
      societyId,
      'Housekeeping request',
    );
    const phasePart = phase ? `/${phase.toLowerCase()}` : '';
    return this.s3.getPresignedUploadUrl(`housekeeping/${id}${phasePart}`, contentType);
  }

  async create(userId: string, societyId: string, dto: CreateHousekeepingDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.housekeepingRequest.create({
      data: {
        residentId: resident.id,
        societyId,
        type: dto.type as any,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        status: 'PENDING',
      },
    });
  }

  async findForResident(userId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { residentId: resident.id };
    const [data, total] = await Promise.all([
      this.prisma.housekeepingRequest.findMany({
        where,
        select: {
          id: true, type: true, scheduledAt: true, status: true,
          notes: true, rating: true, review: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.housekeepingRequest.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  /**
   * The society's housekeeping requests, or — with `assignedStaffId` — only
   * those assigned to one staff member (what staff see).
   *
   * Rows carry `resident.name`, `resident.unit.flatNumber` and `staffName`,
   * which is what the admin page renders; it read those and got nothing, so
   * the resident, flat and staff columns were always blank.
   */
  async findForAdmin(
    societyId: string,
    status?: string,
    date?: string,
    page = 1,
    limit = 20,
    assignedStaffId?: string,
  ) {
    const where: any = { societyId };
    if (status) where.status = status;
    if (assignedStaffId) where.staffId = assignedStaffId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.housekeepingRequest.findMany({
        where,
        select: {
          id: true, type: true, scheduledAt: true, status: true,
          notes: true, rating: true, createdAt: true, staffId: true,
          resident: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
              flat: { select: { id: true, block: true, number: true, floor: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.housekeepingRequest.count({ where }),
    ]);

    const staffIds = [...new Set(rows.map((r) => r.staffId).filter((x): x is string => !!x))];
    const staff = staffIds.length
      ? await this.prisma.staffMember.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const staffName = new Map(staff.map((s) => [s.id, s.user?.name ?? null]));

    const data = rows.map((r) => {
      const flat = r.resident?.flat;
      return {
        ...r,
        staffName: r.staffId ? staffName.get(r.staffId) ?? null : null,
        resident: r.resident && {
          ...r.resident,
          name: r.resident.user?.name ?? null,
          unit: { flatNumber: flat ? [flat.block, flat.number].filter(Boolean).join('-') : null },
        },
      };
    });
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findForStaff(userId: string, societyId: string, status?: string, page = 1, limit = 20) {
    const me = await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (!me) throw new NotFoundException('Staff profile not found');
    return this.findForAdmin(societyId, status, undefined, page, limit, me.id);
  }

  async findOneAsStaff(id: string, userId: string, societyId: string) {
    const me = await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    const request = await this.prisma.housekeepingRequest.findFirst({
      where: { id, societyId, ...(me ? { staffId: me.id } : { id: '__none__' }) },
      include: { resident: RESIDENT_BRIEF },
    });
    if (!request) throw new NotFoundException('Housekeeping request not found');
    return request;
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const request = await this.prisma.housekeepingRequest.findUnique({
      where: { id },
      include: { resident: { include: { user: true, flat: true } } },
    });
    if (!request || request.residentId !== resident.id) {
      throw new NotFoundException('Housekeeping request not found');
    }
    return request;
  }

  async findOneAsAdmin(id: string, societyId: string) {
    return requireOwnedById(
      () =>
        this.prisma.housekeepingRequest.findUnique({
          where: { id },
          include: { resident: { include: { user: true, flat: true } } },
        }),
      societyId,
      'Housekeeping request',
    );
  }

  async cancel(id: string, userId: string) {
    const request = await this.findOne(id, userId);
    if (!['PENDING', 'CONFIRMED'].includes(request.status)) {
      throw new BadRequestException('Only PENDING or CONFIRMED requests can be cancelled');
    }
    return this.prisma.housekeepingRequest.update({
      where: { id },
      data: { status: 'CANCELLED' as any },
    });
  }

  async rate(id: string, userId: string, dto: RateHousekeepingDto) {
    const request = await this.findOne(id, userId);
    if (request.status !== 'COMPLETED') {
      throw new ForbiddenException('You can only rate completed housekeeping requests');
    }
    return this.prisma.housekeepingRequest.update({
      where: { id },
      data: { rating: dto.rating, review: dto.review },
    });
  }

  /**
   * Change a request's status — and, for admins, who is assigned.
   *
   * Staff could update ANY request in the society before; now only the one
   * assigned to them, and they cannot reassign it. Admin assignment was a
   * free-text field the API rejected with a 400 on every save.
   */
  async updateStatus(
    id: string,
    societyId: string,
    dto: UpdateHousekeepingStatusDto,
    actor?: { userId: string; role: string },
  ) {
    const request = await this.findOneAsAdmin(id, societyId);
    if (actor?.role === 'STAFF') {
      const me = await this.prisma.staffMember.findUnique({ where: { userId: actor.userId }, select: { id: true } });
      if (!me || request.staffId !== me.id) {
        throw new ForbiddenException({ code: 'NOT_YOUR_REQUEST', message: 'This request is not assigned to you.' });
      }
      if (dto.staffId !== undefined) {
        throw new ForbiddenException({ code: 'STAFF_FIELD_NOT_ALLOWED', message: 'Staff cannot reassign requests.' });
      }
    }
    let assignTo: { id: string; userId: string } | null = null;
    if (dto.staffId) {
      assignTo = await this.prisma.staffMember.findFirst({
        where: { id: dto.staffId, societyId, deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!assignTo) throw new BadRequestException({ code: 'STAFF_NOT_FOUND', message: 'Pick a staff member from this society.' });
    }
    const isCompleting = String(dto.status) === 'COMPLETED';
    const updated = await this.prisma.housekeepingRequest.update({
      where: { id: request.id },
      data: {
        status: dto.status as any,
        ...(assignTo ? { staffId: assignTo.id } : {}),
        // Persist the evidence the staff app has always sent. Only overwrite
        // when a value is supplied, so a later status change cannot wipe the
        // photos captured at completion.
        ...(dto.beforePhotoUrl ? { beforePhotoUrl: dto.beforePhotoUrl } : {}),
        ...(dto.afterPhotoUrl ? { afterPhotoUrl: dto.afterPhotoUrl } : {}),
        ...(dto.notes ? { completionNotes: dto.notes } : {}),
        ...(isCompleting && !request.completedAt ? { completedAt: new Date() } : {}),
      },
    });

    const bodyByStatus: Record<string, { type: string; body: string }> = {
      CONFIRMED: { type: 'HOUSEKEEPING_SCHEDULED', body: 'Your housekeeping request has been scheduled.' },
      SCHEDULED: { type: 'HOUSEKEEPING_SCHEDULED', body: 'Your housekeeping request has been scheduled.' },
      COMPLETED: { type: 'HOUSEKEEPING_COMPLETED', body: 'Your housekeeping request has been completed.' },
    };
    const mapped = bodyByStatus[String(dto.status)];
    const userId = request.resident?.userId;
    if (mapped && userId) {
      void this.push
        .send(
          userId,
          { title: 'Housekeeping update', body: mapped.body, category: 'daily_help', collapseKey: `housekeeping:${request.id}` },
          { type: mapped.type, entityId: request.id, requestId: request.id, status: String(dto.status) },
        )
        .catch((e) => this.logger.warn(`housekeeping push failed id=${request.id}: ${(e as Error).message}`));
    }

    if (assignTo && assignTo.id !== request.staffId) {
      void this.push
        .send(
          assignTo.userId,
          {
            title: 'Housekeeping assigned',
            body: `New housekeeping job: ${request.type.replace(/_/g, ' ').toLowerCase()}.`,
            category: 'staff_tasks',
            collapseKey: `housekeeping:${request.id}`,
          },
          { type: 'HOUSEKEEPING_ASSIGNED', entityId: request.id },
        )
        .catch((e) => this.logger.warn(`housekeeping assign push failed id=${request.id}: ${(e as Error).message}`));
    }

    return updated;
  }
}
