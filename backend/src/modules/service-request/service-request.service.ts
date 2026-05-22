import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceRequestStatus, ServicePhase } from '@prisma/client';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestStatusDto,
  RateServiceRequestDto,
} from './dto/service-request.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { SERVICE_REQUEST_TRANSITIONS } from './service-request.transitions';
import { S3Service } from '../../common/storage/s3.service';
import { ServiceRequestGateway } from './service-request.gateway';

const SOCIETY_MISMATCH = { code: 'SERVICE_REQUEST_SOCIETY_MISMATCH', message: 'Service request belongs to another society' };

@Injectable()
export class ServiceRequestService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private serviceRequestGateway: ServiceRequestGateway,
  ) {}

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
    sr: { societyId: string; assignedToId: string | null; status: ServiceRequestStatus },
    staffId: string,
    jwtSocietyId: string,
  ) {
    this.assertSocietyMatch(sr.societyId, jwtSocietyId);
    if (!sr.assignedToId) {
      throw new ForbiddenException({ code: 'NOT_ASSIGNED_STAFF', message: 'Task is not assigned to a staff member' });
    }
    if (sr.assignedToId !== staffId) {
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

    return this.prisma.serviceRequest.create({
      data: { residentId: resident.id, societyId, ...dto, ...(slaDeadline && { slaDeadline }) },
    });
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

    return this.prisma.serviceRequest.findMany({
      where: { residentId: resident.id, societyId },
      include: { photos: true, assignedTo: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySociety(societyId: string, status?: ServiceRequestStatus, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length
      ? { resident: { flat: { block: { in: managedBlocks } } } }
      : {};
    return this.prisma.serviceRequest.findMany({
      where: { societyId, ...(status && { status }), ...blockWhere },
      include: {
        resident: { include: { user: true, flat: true } },
        assignedTo: { include: { user: true } },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStaff(userId: string, societyId: string) {
    const staffId = await this.resolveStaffId(userId);
    const staff = await this.prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || staff.societyId !== societyId) {
      throw new ForbiddenException({ code: 'STAFF_SOCIETY_MISMATCH', message: 'Staff profile society mismatch' });
    }

    return this.prisma.serviceRequest.findMany({
      where: { assignedToId: staffId, societyId },
      include: {
        resident: { include: { user: true, flat: true } },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, opts?: { residentUserId?: string; societyId?: string }) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        resident: { include: { user: true, flat: true } },
        assignedTo: { include: { user: true } },
        photos: true,
      },
    });
    if (!req) throw new NotFoundException('Service request not found');

    if (opts?.residentUserId) {
      const resident = await requireResidentByUserId(this.prisma, opts.residentUserId);
      if (req.residentId !== resident.id) {
        throw new ForbiddenException('Service request does not belong to this resident');
      }
    }

    if (opts?.societyId !== undefined) {
      this.assertSocietyMatch(req.societyId, opts.societyId);
    }

    return req;
  }

  async updateStatus(id: string, societyId: string, dto: UpdateServiceRequestStatusDto) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);

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
          ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
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
      ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
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

    return this.prisma.serviceRequest.update({
      where: { id },
      data: data as any,
    });
  }

  async assignStaff(id: string, societyId: string, staffMemberId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffMemberId, societyId },
    });
    if (!staff) {
      throw new BadRequestException({
        code: 'STAFF_NOT_IN_SOCIETY',
        message: 'Staff member not found in this society',
      });
    }

    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service request not found');
    this.assertSocietyMatch(existing.societyId, societyId);

    const activeCount = await this.prisma.serviceRequest.count({
      where: {
        assignedToId: staffMemberId,
        status: { in: [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.IN_PROGRESS] },
      },
    });
    if (activeCount >= 3) {
      throw new ConflictException({
        code: 'STAFF_OVERLOADED',
        message: 'Staff member already has 3 or more active assignments. Please choose another staff member.',
      });
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
        assignedToId: staffMemberId,
        status: ServiceRequestStatus.ASSIGNED,
        rejectedReason: null,
      },
    });

    this.serviceRequestGateway.emitTaskAssigned(staffMemberId, {
      taskId: updated.id,
      title: updated.category,
      address: updated.description,
      urgency: null,
      assignedAt: new Date().toISOString(),
    });

    return updated;
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
    if (updated.assignedToId) {
      this.serviceRequestGateway.emitTaskAssigned(updated.assignedToId, {
        taskId: updated.id,
        title: `DISPUTE: ${updated.category}`,
        address: reason,
        urgency: 'HIGH',
        assignedAt: new Date().toISOString(),
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

    // Find all active staff in society, pick the one with fewest active tasks
    const allStaff = await this.prisma.staffMember.findMany({ where: { societyId, deletedAt: null } });
    if (!allStaff.length) throw new BadRequestException({ code: 'NO_STAFF', message: 'No active staff available' });

    const counts = await Promise.all(
      allStaff.map(async (s) => ({
        staff: s,
        count: await this.prisma.serviceRequest.count({
          where: { assignedToId: s.id, status: { in: [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.IN_PROGRESS] } },
        }),
      })),
    );

    // Filter to staff with < 3 active tasks, sort by load
    const eligible = counts.filter((c) => c.count < 3).sort((a, b) => a.count - b.count);
    if (!eligible.length) throw new ConflictException({ code: 'ALL_STAFF_OVERLOADED', message: 'All staff are at capacity (3 active tasks)' });

    const chosen = eligible[0].staff;
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedToId: chosen.id,
        status: ServiceRequestStatus.ASSIGNED,
        ...(scheduledTime ? { scheduledTime: new Date(scheduledTime) } : {}),
        rejectedReason: null,
      },
    });

    this.serviceRequestGateway.emitTaskAssigned(chosen.id, {
      taskId: updated.id,
      title: updated.category,
      address: updated.description,
      urgency: null,
      assignedAt: new Date().toISOString(),
    });

    return updated;
  }

  async assignStaffWithSchedule(id: string, societyId: string, staffMemberId: string, scheduledTime?: string) {
    const updated = await this.assignStaff(id, societyId, staffMemberId);
    if (scheduledTime) {
      return this.prisma.serviceRequest.update({
        where: { id },
        data: { scheduledTime: new Date(scheduledTime) },
      });
    }
    return updated;
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
