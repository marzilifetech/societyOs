import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';
import { CreateHelpRequestDto } from './dto/help-request.dto';
import { RESIDENT_BRIEF } from '../../common/prisma-selects';

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

  async getHelpRequestById(id: string, userId: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await requireOwnedById(
      () => this.prisma.helpRequest.findUnique({ where: { id } }),
      societyId,
      'Help request',
    );
    if (req.residentId !== resident.id) throw new NotFoundException('Help request not found');
    return req;
  }

  async cancelHelpRequest(id: string, userId: string, societyId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await requireOwnedById(
      () => this.prisma.helpRequest.findUnique({ where: { id } }),
      societyId,
      'Help request',
    );
    if (req.residentId !== resident.id) throw new NotFoundException('Help request not found');
    return this.prisma.helpRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async rateHelpRequest(id: string, userId: string, societyId: string, rating: number, comment?: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await requireOwnedById(
      () => this.prisma.helpRequest.findUnique({ where: { id } }),
      societyId,
      'Help request',
    );
    if (req.residentId !== resident.id) throw new NotFoundException('Help request not found');
    return this.prisma.helpRequest.update({
      where: { id },
      data: { rating, ratingText: comment ?? null },
    });
  }

  // Staff-side help requests live in StaffHelpService (they are concierge
  // requests; the staff methods that used to be here read service requests).

  async getHelpRequestPhotoUploadUrl(requestId: string, societyId: string, contentType?: string) {
    // Confirm the request belongs to caller's society before issuing presigned URL.
    await requireOwnedById(
      () => this.prisma.serviceRequest.findUnique({ where: { id: requestId } }),
      societyId,
      'Help request',
    );
    return this.s3.getPresignedUploadUrl(`help-requests/${requestId}`, contentType);
  }
}
