import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateDocumentRequestDto, RateDocumentRequestDto } from './dto/document-request.dto';
import { DocumentRequestStatus } from '@prisma/client';

@Injectable()
export class DocumentRequestService {
  private readonly logger = new Logger(DocumentRequestService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // Notify the requesting resident when their document request is decided.
  private notifyResident(
    residentId: string,
    decided: 'DELIVERED' | 'REJECTED',
    requestId: string,
    note?: string,
  ): void {
    void this.prisma.resident
      .findUnique({ where: { id: residentId }, select: { userId: true } })
      .then((resident) => {
        const userId = resident?.userId;
        if (!userId) return;
        const ready = decided === 'DELIVERED';
        return this.push.send(
          userId,
          {
            title: ready ? 'Document ready' : 'Document request rejected',
            body: ready
              ? 'Your requested document is ready to download.'
              : `Your document request was rejected${note ? `: ${note}` : '.'}`,
            category: 'account_auth',
            collapseKey: `docreq:${requestId}`,
          },
          {
            type: ready ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
            entityId: requestId,
          },
        );
      })
      .catch((e) => this.logger.warn(`document-request push failed id=${requestId}: ${(e as Error).message}`));
  }

  async create(userId: string, societyId: string, dto: CreateDocumentRequestDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.documentRequest.create({
      data: {
        residentId: resident.id,
        societyId,
        type: dto.type,
        purpose: dto.purpose,
        requiredBy: dto.requiredBy ? new Date(dto.requiredBy) : undefined,
      },
    });
  }

  async findMy(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.documentRequest.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.prisma.documentRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Document request not found');
    return req;
  }

  async download(id: string, userId: string) {
    const req = await this.findOne(id, userId);
    if (!req.documentUrl) throw new BadRequestException('Document not ready yet');
    return { documentUrl: req.documentUrl };
  }

  async rate(id: string, userId: string, dto: RateDocumentRequestDto) {
    const req = await this.findOne(id, userId);
    if (req.status !== DocumentRequestStatus.DELIVERED) {
      throw new BadRequestException('Can only rate delivered documents');
    }
    return this.prisma.documentRequest.update({
      where: { id },
      data: { rating: dto.rating },
    });
  }

  async findAll(societyId: string) {
    return this.prisma.documentRequest.findMany({
      where: { societyId },
      orderBy: { createdAt: 'desc' },
      include: {
        resident: {
          include: { user: { select: { name: true } }, flat: { select: { block: true, number: true } } },
        },
      },
    });
  }

  async approve(id: string, documentUrl?: string, adminNotes?: string) {
    const req = await this.prisma.documentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Document request not found');
    const updated = await this.prisma.documentRequest.update({
      where: { id },
      data: {
        status: DocumentRequestStatus.DELIVERED,
        ...(documentUrl ? { documentUrl } : {}),
        ...(adminNotes ? { adminNotes } : {}),
      },
    });
    this.notifyResident(req.residentId, 'DELIVERED', id);
    return updated;
  }

  async reject(id: string, reason: string) {
    const req = await this.prisma.documentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Document request not found');
    const updated = await this.prisma.documentRequest.update({
      where: { id },
      data: { status: 'REJECTED' as any, adminNotes: reason },
    });
    this.notifyResident(req.residentId, 'REJECTED', id, reason);
    return updated;
  }
}
