import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResidentType, UserStatus } from '@prisma/client';
import { findResidentByUserId } from '../../common/utils/resident-context';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ResidentService {
  private readonly logger = new Logger(ResidentService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getProfile(userId: string) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) {
      // Observability: an ACTIVE user without a Resident row is a manual-edit
      // mismatch (admin set status without creating the row) — the app's root
      // tabs guard redirects them to pending-approval, but we log it here so
      // we can spot recurring incidents in the backend log without crawling
      // the database. We don't change behaviour — the 404 still throws.
      const user = await this.prisma.user
        .findUnique({ where: { id: userId }, select: { status: true } })
        .catch(() => null);
      if (user?.status === UserStatus.ACTIVE) {
        this.logger.warn(
          `Active user without Resident row: userId=${userId}. Status==ACTIVE but no resident profile — onboarding likely skipped or manually edited.`,
        );
      }
      throw new NotFoundException('Resident profile not found');
    }
    return resident;
  }

  /** Society residents with a date of birth (frontend groups Today / This Week / Next Week). */
  async getBirthdays(societyId: string) {
    const residents = await this.prisma.resident.findMany({
      where: { flat: { societyId }, dateOfBirth: { not: null } },
      include: { user: { select: { name: true } }, flat: { select: { block: true, number: true } } },
    });
    return residents.map((r) => ({
      id: r.id,
      name: r.user?.name ?? 'Resident',
      flat: `${r.flat.block}-${r.flat.number}`,
      date: r.dateOfBirth,
    }));
  }

  async updateProfile(
    userId: string,
    data: { name?: string; email?: string; emergencyContactName?: string; emergencyContactPhone?: string },
  ) {
    const resident = await this.getProfile(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name, email: data.email },
    });

    if (data.emergencyContactName || data.emergencyContactPhone) {
      await this.prisma.resident.update({
        where: { userId },
        data: {
          emergencyContact: {
            name: data.emergencyContactName ?? (resident.emergencyContact as any)?.name,
            phone: data.emergencyContactPhone ?? (resident.emergencyContact as any)?.phone,
          },
        },
      });
    }

    return this.getProfile(userId);
  }

  async onboard(
    userId: string,
    societyId: string,
    data: {
      flatId: string;
      name: string;
      type: ResidentType;
      email?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      consentAccepted: boolean;
    },
  ) {
    const flat = await this.prisma.flat.findFirst({
      where: { id: data.flatId, societyId },
    });

    if (!flat) {
      throw new BadRequestException('Selected flat does not belong to your society');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const emergencyContact =
      data.emergencyContactName || data.emergencyContactPhone
        ? {
            name: data.emergencyContactName ?? '',
            phone: data.emergencyContactPhone ?? '',
          }
        : undefined;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        status: user.status === UserStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.PENDING,
      },
    });

    await this.prisma.resident.upsert({
      where: { userId },
      create: {
        userId,
        flatId: data.flatId,
        type: data.type,
        emergencyContact,
      },
      update: {
        flatId: data.flatId,
        type: data.type,
        emergencyContact,
      },
    });

    // Notify admins of new pending resident
    const admins = await this.prisma.user.findMany({
      where: { societyId, role: { in: ['ADMIN', 'SUPER_ADMIN'] as any }, fcmToken: { not: null } },
      select: { fcmToken: true },
    });
    const adminTokens = admins.map((a) => a.fcmToken).filter(Boolean) as string[];
    if (adminTokens.length > 0) {
      await this.notificationService.sendToMultiple(adminTokens, {
        title: 'New Resident Pending Approval',
        body: `${data.name} has registered for Flat ${flat.block}-${flat.number}. Please review.`,
        data: { type: 'NEW_RESIDENT_PENDING', userId },
      });
    }

    if (data.consentAccepted) {
      await this.prisma.consentLog.create({
        data: {
          userId,
          action: 'RESIDENT_ONBOARDING_CONSENT',
          details: {
            flatId: data.flatId,
            residentType: data.type,
          },
        },
      });
    }

    return this.getProfile(userId);
  }

  async findBySociety(societyId: string, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length ? { flat: { block: { in: managedBlocks } } } : {};
    return this.prisma.resident.findMany({
      where: { user: { societyId }, ...blockWhere },
      include: { user: true, flat: true },
    });
  }

  async uploadDocuments(
    userId: string,
    data: {
      aadhaarUrl?: string;
      aadhaarNumber?: string;
      panUrl?: string;
      panNumber?: string;
      idProofUrl?: string;
      addressProofUrl?: string;
    },
  ) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');

    // TODO(security): encrypt Aadhaar number at rest. For now we store it
    // as raw bytes — the Aadhaar column is typed as Bytes? so callers must
    // serialize. When the encryption helper lands, wrap the buffer here.
    const aadhaarBytes = data.aadhaarNumber
      ? Buffer.from(data.aadhaarNumber, 'utf8')
      : undefined;

    return this.prisma.resident.update({
      where: { id: resident.id },
      data: {
        ...(aadhaarBytes ? { aadhaar: aadhaarBytes } : {}),
        ...(data.aadhaarUrl !== undefined ? { aadhaarUrl: data.aadhaarUrl } : {}),
        ...(data.panNumber ? { panNumber: data.panNumber } : {}),
        ...(data.panUrl !== undefined ? { panUrl: data.panUrl } : {}),
        ...(data.idProofUrl !== undefined ? { idProof: data.idProofUrl } : {}),
        ...(data.addressProofUrl !== undefined ? { addressProof: data.addressProofUrl } : {}),
        documentsStatus: 'UPLOADED' as any,
      },
    });
  }

  async getDocumentsStatus(userId: string) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');

    return {
      idProof: resident.idProof,
      addressProof: resident.addressProof,
      status: resident.documentsStatus,
    };
  }

  async getMyDocuments(userId: string) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');

    const aadhaarLast4 =
      resident.aadhaar && resident.aadhaar.length >= 4
        ? Buffer.from(resident.aadhaar as unknown as Uint8Array).toString('utf8').slice(-4)
        : null;

    return {
      status: resident.documentsStatus,
      aadhaarLast4,
      aadhaarUrl: (resident as any).aadhaarUrl ?? null,
      panNumber: resident.panNumber,
      panUrl: (resident as any).panUrl ?? null,
      idProofUrl: resident.idProof,
      addressProofUrl: resident.addressProof,
    };
  }

  async getDirectory(societyId: string) {
    const residents = await this.prisma.resident.findMany({
      where: {
        showInDirectory: true,
        flat: { societyId },
        deletedAt: null,
        isAnonymised: false,
      },
      include: { user: true, flat: true },
      orderBy: { createdAt: 'asc' },
    });

    return residents.map((r) => ({
      id: r.id,
      name: r.user?.name ?? 'Resident',
      flat: { block: r.flat?.block ?? '', number: r.flat?.number ?? '' },
      phone: r.user?.phone,
    }));
  }

  async getEmergencyContacts(societyId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const config = (society.config as Record<string, unknown> | null) ?? {};
    const contacts = (config.emergencyContacts as unknown[] | undefined) ?? [];
    // Surface a shape consistent with admin-web's existing settings UI.
    return { id: society.id, config: { emergencyContacts: contacts } };
  }

  async setDirectoryVisibility(userId: string, visible: boolean) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');
    return this.prisma.resident.update({
      where: { userId },
      data: { showInDirectory: visible },
      select: { id: true, showInDirectory: true },
    });
  }
}
