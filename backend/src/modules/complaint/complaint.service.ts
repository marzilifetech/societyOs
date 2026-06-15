import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComplaintDto, RateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { ComplaintGateway } from './complaint.gateway';

@Injectable()
export class ComplaintService {
  constructor(
    private prisma: PrismaService,
    private complaintGateway: ComplaintGateway,
  ) {}

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
    const updated = await this.prisma.complaint.update({ where: { id }, data: dto as any });

    this.complaintGateway.emitComplaintUpdated(updated.residentId, {
      complaintId: updated.id,
      status: updated.status,
      message: (updated as any).adminNote ?? null,
      updatedAt: new Date().toISOString(),
    });

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
