import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Server-backed notification inbox. Reads from notification_logs, which is the
 * same table PushService writes to when delivering FCM messages — so the inbox
 * is an exact mirror of what reached the device (or would have, when the device
 * was offline). The unread badge is driven by `readAt IS NULL`.
 */
@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  /**
   * Cursor-paginated list for the current user. Cursor is the `id` of the last
   * row from the previous page; with the `(userId, createdAt DESC)` index this
   * is a single index scan with no offset cost.
   */
  async list(userId: string, opts: { cursor?: string; limit?: number } = {}) {
    const take = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const items = await this.prisma.notificationLog.findMany({
      where: { userId, status: { in: ['SENT', 'DEFERRED'] } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      select: {
        id: true,
        category: true,
        type: true,
        title: true,
        body: true,
        data: true,
        createdAt: true,
        readAt: true,
      },
    });
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notificationLog.findUnique({
      where: { id },
      select: { userId: true, readAt: true },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    }
    if (row.readAt) return { readAt: row.readAt };
    const updated = await this.prisma.notificationLog.update({
      where: { id },
      data: { readAt: new Date() },
      select: { readAt: true },
    });
    return updated;
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notificationLog.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notificationLog.count({
      where: { userId, readAt: null, status: { in: ['SENT', 'DEFERRED'] } },
    });
    return { count };
  }
}
