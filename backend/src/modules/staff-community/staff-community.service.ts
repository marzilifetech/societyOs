import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { COLLEAGUE_SELECT } from '../../common/prisma-selects';

/** How far back society emergency broadcasts appear in the staff notice list. */
const BROADCAST_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

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

  /**
   * Staff notices, plus the society's emergency broadcasts from the last
   * month. Broadcasts are pushed to staff, and tapping one opens this list,
   * which used to show only staff notices — so the alert was nowhere to be found.
   */
  async getNotices(societyId: string) {
    const now = new Date();
    const since = new Date(now.getTime() - BROADCAST_LOOKBACK_MS);
    const [staffNotices, broadcasts] = await Promise.all([
      this.prisma.staffNotice.findMany({
        where: { societyId, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
        orderBy: [{ pinnedUntil: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.notice.findMany({
        where: {
          societyId,
          category: 'EMERGENCY',
          publishedAt: { gte: since, lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, title: true, body: true, isPinned: true, publishedAt: true, expiresAt: true, createdAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 20,
      }),
    ]);
    const fromSociety = broadcasts.map((b) => ({
      id: b.id,
      societyId,
      title: b.title,
      body: b.body,
      category: 'SAFETY' as const,
      publishedAt: b.publishedAt,
      pinnedUntil: b.isPinned ? b.expiresAt ?? new Date(now.getTime() + BROADCAST_LOOKBACK_MS) : null,
      createdAt: b.createdAt,
      source: 'society' as const,
    }));
    const pinned = (n: { pinnedUntil: Date | null }) => (n.pinnedUntil && n.pinnedUntil > now ? 1 : 0);
    const when = (n: { publishedAt: Date | null; createdAt: Date }) => (n.publishedAt ?? n.createdAt).getTime();
    return [...fromSociety, ...staffNotices.map((n) => ({ ...n, source: 'staff' as const }))].sort(
      (a, b) => pinned(b) - pinned(a) || when(b) - when(a),
    );
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
    const rows = await this.prisma.recognition.findMany({
      where: { societyId, ...(staffId ? { staffId } : {}) },
      include: {
        // Names only: this board is read by every colleague, and it used to
        // carry each person's full user row (phone, email, DOB…).
        staff: { select: { id: true, designation: true, user: { select: COLLEAGUE_SELECT } } },
        awardedBy: { select: { id: true, designation: true, user: { select: COLLEAGUE_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // The staff app renders these two names; they were never returned, so
    // every card on the board read "undefined".
    return rows.map((r) => ({
      ...r,
      staffName: r.staff?.user?.name ?? null,
      awardedByName: r.awardedBy?.user?.name ?? null,
    }));
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
