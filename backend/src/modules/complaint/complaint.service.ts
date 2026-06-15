import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComplaintDto, RateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { ComplaintGateway } from './complaint.gateway';
import { PushService } from '../../common/notification/push.service';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);
  constructor(
    private prisma: PrismaService,
    private complaintGateway: ComplaintGateway,
    private push: PushService,
  ) {}

  /**
   * Best-effort push for complaint status transitions. Never throws — the
   * complaint update itself must not fail because a notification couldn't
   * be delivered. Body adapts to the new status so the lockscreen text is
   * immediately useful (no "Status changed" stub).
   */
  private notifyResidentOfStatusChange(complaint: {
    id: string;
    status: string;
    title?: string | null;
    resident?: { userId?: string | null } | null;
  }): void {
    try {
      const userId = complaint?.resident?.userId;
      if (!userId) return;
      const title = complaint.title?.trim() || 'Your complaint';
      const statusLabel = String(complaint.status).replace(/_/g, ' ').toLowerCase();
      void this.push
        .send(
          userId,
          {
            title: 'Complaint update',
            body: `${title} is now ${statusLabel}.`,
            category: 'complaints',
            collapseKey: `complaint:${complaint.id}`,
          },
          {
            type: 'COMPLAINT_UPDATED',
            entityId: complaint.id,
            complaintId: complaint.id,
            status: String(complaint.status),
          },
        )
        .catch((err) => {
          this.logger.warn(`complaint push failed id=${complaint.id}: ${(err as Error).message}`);
        });
    } catch {
      /* never let a push break the complaint update */
    }
  }

  async create(userId: string, societyId: string, dto: CreateComplaintDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.complaint.create({
      data: { residentId: resident.id, societyId, ...dto, description: dto.description ?? dto.title },
    });
  }

  async findByResident(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    return this.prisma.complaint.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: { resident: { include: { user: true, flat: true } } },
    });

    if (!complaint || complaint.residentId !== resident.id) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }

  async findBySociety(societyId: string, status?: string, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length
      ? { resident: { flat: { block: { in: managedBlocks } } } }
      : {};
    return this.prisma.complaint.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}), ...blockWhere },
      include: {
        resident: { include: { user: true, flat: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: dto as any,
      include: { resident: { include: { user: true } } },
    });

    this.complaintGateway.emitComplaintUpdated(updated.residentId, {
      complaintId: updated.id,
      status: updated.status,
      message: (updated as any).adminNote ?? null,
      updatedAt: new Date().toISOString(),
    });

    // Only fire push when status actually changed — title/note edits don't
    // warrant a lockscreen interruption.
    if (dto.status && dto.status !== complaint.status) {
      this.notifyResidentOfStatusChange({
        id: updated.id,
        status: updated.status,
        title: updated.title,
        resident: { userId: updated.resident?.user?.id ?? null },
      });
    }

    return updated;
  }

  async rate(id: string, userId: string, dto: RateComplaintDto) {
    const complaint = await this.findOne(id, userId);

    if (!['RESOLVED', 'CLOSED'].includes(complaint.status)) {
      throw new ForbiddenException('You can only rate complaints after they are resolved');
    }

    return this.prisma.complaint.update({
      where: { id },
      data: { rating: dto.rating, ratingNote: dto.note },
    });
  }
}
