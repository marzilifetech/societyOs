import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResidentType, UserStatus } from '@prisma/client';
import { findResidentByUserId } from '../../common/utils/resident-context';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ResidentService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getProfile(userId: string) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');
    return resident;
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

  async uploadDocuments(userId: string, idProof: string, addressProof: string) {
    const resident = await findResidentByUserId(this.prisma, userId);
    if (!resident) throw new NotFoundException('Resident profile not found');
    
    return this.prisma.resident.update({
      where: { id: resident.id },
      data: {
        idProof,
        addressProof,
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
