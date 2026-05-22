import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportIncidentDto, UpdateStatusDto, ResolveIncidentDto } from './dto/infrastructure.dto';

@Injectable()
export class InfrastructureService {
  constructor(private prisma: PrismaService) {}

  async getStatus(societyId: string) {
    return this.prisma.infrastructureItem.findMany({
      where: { societyId },
      include: { incidents: { where: { resolvedAt: null }, orderBy: { createdAt: 'desc' }, take: 3 } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.infrastructureItem.findUnique({
      where: { id },
      include: { incidents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!item) throw new NotFoundException('Infrastructure item not found');
    return item;
  }

  async reportIncident(userId: string, dto: ReportIncidentDto) {
    await this.findOne(dto.itemId);
    return this.prisma.infraIncident.create({
      data: {
        itemId: dto.itemId,
        reportedBy: userId,
        description: dto.description,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async updateStatus(id: string, userId: string, dto: UpdateStatusDto) {
    await this.findOne(id);
    return this.prisma.infrastructureItem.update({
      where: { id },
      data: { status: dto.status, lastUpdatedBy: userId },
    });
  }

  async resolveIncident(id: string, dto: ResolveIncidentDto) {
    const incident = await this.prisma.infraIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    return this.prisma.infraIncident.update({
      where: { id },
      data: { resolution: dto.resolution, resolvedAt: new Date() },
    });
  }
}
