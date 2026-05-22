import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateHelpRequestDto } from './dto/help-request.dto';

const HELP_CATEGORIES = ['HELP_HEAVY', 'HELP_DOCUMENT', 'HELP_PACKAGE'];

@Injectable()
export class HelpRequestService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private s3: S3Service,
  ) {}

  // ── Resident methods ─────────────────────────────────────────────────────────

  async getResidentHelpRequests(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.helpRequest.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHelpRequest(userId: string, societyId: string, dto: CreateHelpRequestDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.helpRequest.create({
      data: {
        residentId: resident.id,
        societyId,
        title: dto.category,
        description: dto.description,
        category: dto.urgency,
        status: 'OPEN',
      },
    });
  }

  async getHelpRequestById(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.prisma.helpRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Help request not found');
    return req;
  }

  // ── Staff methods ─────────────────────────────────────────────────────────────

  private async resolveStaffId(userId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.id;
  }

  async getMyHelpRequests(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.prisma.serviceRequest.findMany({
      where: {
        assignedToId: staffId,
        category: { in: HELP_CATEGORIES },
      },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeHelpRequest(userId: string, requestId: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Help request not found');
    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED', resolvedAt: new Date() },
    });
    this.realtime.emit(`resident:${sr.residentId}`, 'help:completed', { requestId, staffId });
    return updated;
  }

  async getMyHelpRequestById(userId: string, requestId: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { resident: { include: { user: true, flat: true } } },
    });
    if (!sr || sr.assignedToId !== staffId) {
      throw new NotFoundException('Help request not found');
    }
    return sr;
  }

  async acceptHelpRequest(userId: string, requestId: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Help request not found');
    return this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'ASSIGNED', assignedToId: staffId, acceptedAt: new Date() },
    });
  }

  async updateHelpRequestStatus(
    userId: string,
    requestId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  ) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Help request not found');
    if (sr.assignedToId && sr.assignedToId !== staffId) {
      throw new NotFoundException('Help request not found');
    }
    const data: any = { status };
    if (status === 'COMPLETED') data.resolvedAt = new Date();
    return this.prisma.serviceRequest.update({ where: { id: requestId }, data });
  }

  async getHelpRequestPhotoUploadUrl(requestId: string, contentType?: string) {
    return this.s3.getPresignedUploadUrl(`help-requests/${requestId}`, contentType);
  }
}
