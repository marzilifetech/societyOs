import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  // --- Incidents ---

  async getIncidents(societyId: string, status?: string) {
    return this.prisma.securityIncident.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reportIncident(societyId: string, reportedBy: string, dto: { type: string; description: string; severity?: string }) {
    return this.prisma.securityIncident.create({
      data: {
        societyId,
        reportedBy,
        type: dto.type as any,
        description: dto.description,
        severity: (dto.severity as any) ?? 'LOW',
      },
    });
  }

  async updateIncident(id: string, societyId: string, dto: { status?: string; resolution?: string }) {
    await requireOwnedById(
      () => this.prisma.securityIncident.findUnique({ where: { id } }),
      societyId,
      'Incident',
    );
    return this.prisma.securityIncident.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.resolution ? { resolution: dto.resolution, resolvedAt: new Date() } : {}),
      },
    });
  }

  // --- Rounds ---

  async startRound(societyId: string, staffId: string) {
    const staff = await this.prisma.staffMember.findFirst({ where: { userId: staffId, societyId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    return this.prisma.securityRound.create({
      data: { societyId, staffId: staff.id, status: 'IN_PROGRESS' },
    });
  }

  async completeRound(roundId: string, societyId: string, staffUserId: string, notes?: string) {
    const round = await requireOwnedById(
      () => this.prisma.securityRound.findUnique({ where: { id: roundId } }),
      societyId,
      'Round',
    );
    const completedAt = new Date();
    const durationMin = Math.round((completedAt.getTime() - round.startedAt.getTime()) / 60000);
    return this.prisma.securityRound.update({
      where: { id: roundId },
      data: { status: 'COMPLETED', completedAt, durationMin, ...(notes ? { notes } : {}) },
    });
  }

  async getRounds(societyId: string, date?: string) {
    const where: any = { societyId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.startedAt = { gte: d, lte: end };
    }
    return this.prisma.securityRound.findMany({
      where,
      include: { staff: { include: { user: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
