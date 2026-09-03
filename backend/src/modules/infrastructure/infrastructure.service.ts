import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportIncidentDto, UpdateStatusDto, ResolveIncidentDto } from './dto/infrastructure.dto';
import { IncidentSeverity, InfrastructureStatus } from '@prisma/client';

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
    const item = await this.findOne(dto.itemId);
    const incident = await this.prisma.infraIncident.create({
      data: {
        itemId: dto.itemId,
        reportedBy: userId,
        title: dto.title?.trim() || null,
        description: dto.description,
        severity: dto.severity ?? IncidentSeverity.MEDIUM,
        photoUrl: dto.photoUrl,
      },
    });

    // A reported fault should be visible on the asset itself, not only buried
    // in the incidents tab. CRITICAL/HIGH faults flip the item out of
    // OPERATIONAL so the status board tells the truth at a glance.
    const severe =
      incident.severity === IncidentSeverity.CRITICAL || incident.severity === IncidentSeverity.HIGH;
    if (severe && item.status === InfrastructureStatus.OPERATIONAL) {
      await this.prisma.infrastructureItem.update({
        where: { id: item.id },
        data: { status: InfrastructureStatus.FAULT, lastUpdatedBy: userId },
      });
    }

    return incident;
  }

  async updateStatus(id: string, userId: string, dto: UpdateStatusDto) {
    await this.findOne(id);
    return this.prisma.infrastructureItem.update({
      where: { id },
      data: { status: dto.status, lastUpdatedBy: userId },
    });
  }

  async resolveIncident(id: string, dto: ResolveIncidentDto, userId?: string) {
    const incident = await this.prisma.infraIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    if (incident.resolvedAt) return incident; // idempotent
    const resolved = await this.prisma.infraIncident.update({
      where: { id },
      data: {
        resolution: dto.resolution?.trim() || 'Resolved by admin',
        resolvedAt: new Date(),
        resolvedBy: userId ?? null,
      },
    });

    // Last open incident cleared -> the asset is operational again.
    const stillOpen = await this.prisma.infraIncident.count({
      where: { itemId: incident.itemId, resolvedAt: null },
    });
    if (stillOpen === 0) {
      await this.prisma.infrastructureItem
        .update({
          where: { id: incident.itemId },
          data: { status: InfrastructureStatus.OPERATIONAL, ...(userId ? { lastUpdatedBy: userId } : {}) },
        })
        .catch(() => undefined);
    }

    return resolved;
  }
}
