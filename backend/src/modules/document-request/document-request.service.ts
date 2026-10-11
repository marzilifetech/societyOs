import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { toEnumKey } from '../../common/utils/dto-transforms';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateDocumentRequestDto, RateDocumentRequestDto } from './dto/document-request.dto';
import { DocumentRequestStatus, DocumentRequestType } from '@prisma/client';

/** App labels with no DocumentRequestType of their own. */
const DOCUMENT_TYPE_ALIASES: Record<string, DocumentRequestType> = {
  NO_OBJECTION_CERTIFICATE: DocumentRequestType.NOC,
  MAINTENANCE_RECEIPT: DocumentRequestType.PAYMENT_CERT,
  PAYMENT_CERTIFICATE: DocumentRequestType.PAYMENT_CERT,
  OWNERSHIP_CERTIFICATE: DocumentRequestType.OWNERSHIP_CERT,
};

/**
 * The type for a label or enum key, plus the label to keep in the purpose
 * when the type alone would lose what was asked for ("Possession Letter" is
 * stored as OTHER).
 */
export function documentTypeFor(input: string): { type: DocumentRequestType; label: string | null } {
  const key = String(toEnumKey(input));
  if ((Object.values(DocumentRequestType) as string[]).includes(key)) {
    return { type: key as DocumentRequestType, label: null };
  }
  const aliased = DOCUMENT_TYPE_ALIASES[key];
  return { type: aliased ?? DocumentRequestType.OTHER, label: aliased ? null : input.trim() };
}

/** `requestedAt` and `url` are the names the resident app reads. */
function withAppAliases<T extends { createdAt: Date; documentUrl: string | null }>(req: T) {
  return { ...req, requestedAt: req.createdAt, url: req.documentUrl };
}

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
    const { type, label } = documentTypeFor(dto.type);
    // Keep the resident's own wording when it had no type of its own.
    const purpose = [label, dto.purpose ?? dto.notes].filter(Boolean).join(' — ') || dto.type;
    const created = await this.prisma.documentRequest.create({
      data: {
        residentId: resident.id,
        societyId,
        type,
        purpose,
        requiredBy: dto.requiredBy ? new Date(dto.requiredBy) : undefined,
      },
    });
    return withAppAliases(created);
  }

  async findMy(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const rows = await this.prisma.documentRequest.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(withAppAliases);
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const req = await this.prisma.documentRequest.findUnique({ where: { id } });
    if (!req || req.residentId !== resident.id) throw new NotFoundException('Document request not found');
    return withAppAliases(req);
  }

  async download(id: string, userId: string) {
    const req = await this.findOne(id, userId);
    if (!req.documentUrl) throw new BadRequestException('Document not ready yet');
    // `url` is what the shipped app opens.
    return { documentUrl: req.documentUrl, url: req.documentUrl };
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
