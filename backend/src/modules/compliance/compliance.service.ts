import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../../common/consent/consent.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * ComplianceService — DPDP/right-to-erasure + data export.
 *
 * Right-to-delete (C1): allowed even with active SOS. The User row is kept
 * (audit lineage) but scrubbed — status SUSPENDED, name/phone/email/DOB and
 * all secrets cleared, push devices removed — so linked SOS alerts and
 * complaints become anonymous. Resident KYC (Aadhaar, PAN, proofs, emergency
 * contact) and staff personal data are cleared; both get `deletedAt`.
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { resident: true, staffMember: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();

    // One transaction: a failure part-way used to leave a half-deleted account
    // (and the staff path ALWAYS failed — `emergencyContact: null` on a Json
    // column is rejected by Prisma; it needs Prisma.DbNull — while the app
    // told the user their account was gone).
    //
    // Linked SOS alerts and complaints keep pointing at this user row, which
    // is scrubbed below; that is what anonymises them. (They were "anonymised"
    // by nulling non-nullable columns, which could never succeed and was
    // silently swallowed.)
    await this.prisma.$transaction(async (tx) => {
      if (user.resident) {
        await this.deleteResidentPersonalData(tx, user.resident.id);
        await tx.resident.update({
          where: { id: user.resident.id },
          data: {
            deletedAt: now,
            isAnonymised: true,
            aadhaar: null,
            aadhaarUrl: null,
            panNumber: null,
            panUrl: null,
            idProof: null,
            addressProof: null,
            emergencyContact: Prisma.DbNull,
            dateOfBirth: null,
          },
        });
      }
      if (user.staffMember) {
        await tx.staffMember.update({
          where: { id: user.staffMember.id },
          data: {
            deletedAt: now,
            emergencyContact: Prisma.DbNull,
            familyDetails: Prisma.DbNull,
            photoUrl: null,
          },
        });
      }
      // No more pushes to a deleted account's phones.
      await tx.device.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'SUSPENDED',
          name: null,
          email: null,
          gender: null,
          dateOfBirth: null,
          phone: `deleted-${userId.slice(0, 8)}`,
          fcmToken: null,
          deviceToken: null,
          totpSecret: null,
          totpEnabled: false,
        },
      });
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
   * What a resident added about themselves and their household. The delete
   * dialog promises family members, vehicles and documents are removed; only
   * the Resident row was being scrubbed. Society records (bills, payments,
   * visitors, parcels, complaints, SOS) are kept, and are anonymised by the
   * user scrub in dataDelete.
   */
  private async deleteResidentPersonalData(tx: Prisma.TransactionClient, residentId: string) {
    const helpers = await tx.domesticHelp.findMany({ where: { residentId }, select: { id: true } });
    const helperIds = helpers.map((h) => h.id);
    const meds = await tx.medication.findMany({ where: { residentId }, select: { id: true } });
    const listings = await tx.propertyListing.findMany({ where: { residentId }, select: { id: true } });

    await tx.familyMember.deleteMany({ where: { residentId } });
    await tx.vehicle.deleteMany({ where: { residentId } });
    await tx.domesticAttendance.deleteMany({ where: { domesticHelpId: { in: helperIds } } });
    await tx.domesticHelpPayment.deleteMany({ where: { domesticHelpId: { in: helperIds } } });
    await tx.domesticHelp.deleteMany({ where: { residentId } });
    await tx.medicationDose.deleteMany({ where: { medicationId: { in: meds.map((m) => m.id) } } });
    await tx.medication.deleteMany({ where: { residentId } });
    await tx.healthRecord.deleteMany({ where: { residentId } });
    await tx.healthVital.deleteMany({ where: { residentId } });
    await tx.subscription.deleteMany({ where: { residentId } });
    await tx.documentRequest.deleteMany({ where: { residentId } });
    await tx.feedback.deleteMany({ where: { residentId } });
    await tx.propertyInterest.deleteMany({ where: { OR: [{ residentId }, { listingId: { in: listings.map((l) => l.id) } }] } });
    await tx.propertyListing.deleteMany({ where: { residentId } });
    // Posts others replied to are withdrawn and emptied rather than deleted.
    await tx.postLike.deleteMany({ where: { residentId } });
    await tx.postComment.deleteMany({ where: { residentId } });
    await tx.communityPost.updateMany({
      where: { residentId },
      data: { status: 'REMOVED', content: '', photoUrls: [] },
    });
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
