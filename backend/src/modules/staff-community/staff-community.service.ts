import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

@Injectable()
export class StaffCommunityService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private realtime: RealtimeGateway,
  ) {}

  private async resolveStaffId(userId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.id;
  }

  async getNotices(societyId: string) {
    return this.prisma.staffNotice.findMany({
      where: { societyId },
      orderBy: [{ pinnedUntil: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getMyGroups(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.prisma.staffMessageGroup.findMany({
      where: { memberIds: { has: staffId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMessages(userId: string, groupId: string, cursor?: string, take = 50) {
    const staffId = await this.resolveStaffId(userId);
    const group = await this.prisma.staffMessageGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (!group.memberIds.includes(staffId)) throw new ForbiddenException('Not a group member');
    return this.prisma.staffMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  async sendMessage(userId: string, groupId: string, body: string) {
    const staffId = await this.resolveStaffId(userId);
    const group = await this.prisma.staffMessageGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (!group.memberIds.includes(staffId)) throw new ForbiddenException('Not a group member');
    const msg = await this.prisma.staffMessage.create({
      data: {
        societyId: group.societyId,
        groupId,
        senderId: staffId,
        body,
      },
    });
    this.realtime.emit(`staff:msg:${groupId}`, 'staff:msg', msg);
    return msg;
  }

  async getTrainingMaterials(societyId: string, category?: string) {
    const items = await this.prisma.trainingMaterial.findMany({
      where: { societyId, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((it) => ({
      ...it,
      signedUrl: it.fileUrl ? this.s3.getSignedReadUrl(it.fileUrl) : null,
    }));
  }

  async getRecognitions(societyId: string, staffId?: string) {
    return this.prisma.recognition.findMany({
      where: { societyId, ...(staffId ? { staffId } : {}) },
      include: {
        staff: { include: { user: true } },
        awardedBy: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendKudos(userId: string, societyId: string, dto: { staffId: string; message: string }) {
    const fromStaffId = await this.resolveStaffId(userId);
    return this.prisma.recognition.create({
      data: {
        societyId,
        staffId: dto.staffId,
        message: dto.message,
        awardedById: fromStaffId,
      },
    });
  }

  async getStaffList(societyId: string) {
    const members = await this.prisma.staffMember.findMany({
      where: { societyId },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return members.map((m) => ({ id: m.id, name: m.user.name ?? 'Unknown' }));
  }
}
