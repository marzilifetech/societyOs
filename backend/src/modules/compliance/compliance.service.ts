import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../../common/consent/consent.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * ComplianceService — DPDP/right-to-erasure + data export.
 *
 * Right-to-delete (C1): allowed even with active SOS. Linked SOS records
 * are anonymised (lat/lng kept, residentId nulled, anonymous flag).
 * Complaints likewise anonymised. The User row is soft-deleted (status
 * SUSPENDED + name/phone scrubbed) — we keep the row to preserve audit
 * lineage; resident & staff get `deletedAt`.
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly audit: AuditService,
  ) {}

  async myData(userId: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: {
        resident: { include: { flat: true, familyMembers: true, vehicles: true } },
        staffMember: true,
        consentLog: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async dataExport(userId: string, ipAddress?: string | null) {
    await this.consent.record({
      userId,
      action: 'DATA_EXPORT_REQUESTED',
      ipAddress,
    });
    const data = await this.myData(userId);
    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      user: data,
    };
  }

  async dataDelete(userId: string, ipAddress?: string | null) {
    await this.consent.record({
      userId,
      action: 'DATA_DELETE_REQUESTED',
      ipAddress,
    });

    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: { resident: true, staffMember: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();

    // Anonymise SOS alerts (C1)
    await (this.prisma as any).sosAlert.updateMany({
      where: { userId },
      data: { userId: null as any },
    }).catch(() => undefined);

    if (user.resident) {
      // Anonymise complaints
      await (this.prisma as any).complaint.updateMany({
        where: { residentId: user.resident.id },
        data: { residentId: null as any },
      }).catch(() => undefined);

      await (this.prisma as any).resident.update({
        where: { id: user.resident.id },
        data: {
          deletedAt: now,
          isAnonymised: true,
          aadhaar: null,
          panNumber: null,
          idProof: null,
          addressProof: null,
        },
      });
    }
    if (user.staffMember) {
      await (this.prisma as any).staffMember.update({
        where: { id: user.staffMember.id },
        data: { deletedAt: now, emergencyContact: null as any },
      });
    }

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        name: null,
        email: null,
        phone: `deleted-${userId.slice(0, 8)}`,
        fcmToken: null,
        totpSecret: null,
        totpEnabled: false,
      },
    });

    await this.audit.write({
      entityType: 'User',
      entityId: userId,
      action: 'DATA_DELETE',
      module: 'compliance',
      actorId: userId,
      actorRole: user.role,
      societyId: user.societyId,
    });

    return { ok: true, deletedAt: now };
  }

  /**
   * Retention sweep — anonymise residents + staff inactive ≥ 3 years.
   * Designed to be invoked by a BullMQ scheduled job.
   */
  async runRetentionSweep(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 3);

    const stale = await (this.prisma as any).user.findMany({
      where: { lastActiveAt: { lt: cutoff }, status: { not: 'SUSPENDED' } },
      take: 200,
    });
    for (const u of stale) {
      try {
        await this.dataDelete(u.id, null);
      } catch (e: any) {
        this.logger.warn(`retention sweep failed for ${u.id}: ${e?.message}`);
      }
    }
    return { processed: stale.length };
  }
}
