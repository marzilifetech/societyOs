import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';
import { SosStatus, UserRole } from '@prisma/client';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SosService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private push: PushService,
    private config: ConfigService,
  ) {}

  async trigger(
    userId: string,
    societyId: string,
    lat?: number,
    lng?: number,
    kind: 'resident' | 'staff' = 'resident',
  ) {
    const alert = await this.prisma.sosAlert.create({
      data: {
        residentId: userId,
        societyId,
        lat,
        lng,
        status: SosStatus.ACTIVE,
      },
    });
    this.realtime.emitSosAlert(societyId, alert);

    const isStaff = kind === 'staff';
    const title = isStaff ? 'Staff SOS alert' : 'SOS Alert!';
    const body = isStaff
      ? 'A staff member has triggered an emergency SOS. Location attached when available.'
      : 'An emergency SOS has been triggered in your society. Location attached when available.';

    await this.push.sendToSociety(
      societyId,
      'ADMIN',
      {
        title,
        body,
        critical: true,
        category: 'sos',
      },
      { type: 'SOS', alertId: String(alert.id) },
    );

    return alert;
  }

  /**
   * Sender adds context after the SOS was fired (append; total note capped at 4000 chars).
   */
  async appendNote(alertId: string, actor: JwtPayload, note: string) {
    const trimmed = note?.trim().slice(0, 2000) ?? '';
    if (!trimmed) {
      throw new ConflictException({ code: 'SOS_NOTE_EMPTY', message: 'Note cannot be empty' });
    }

    const alert = await this.prisma.sosAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('SOS alert not found');
    if (alert.residentId !== actor.sub) {
      throw new ForbiddenException({ code: 'SOS_NOT_OWNER', message: 'Only the person who sent this SOS can add a note' });
    }
    if (alert.status !== SosStatus.ACTIVE && alert.status !== SosStatus.ACKNOWLEDGED) {
      throw new ConflictException({
        code: 'SOS_NOTE_NOT_ALLOWED',
        message: 'Cannot add notes to this alert anymore',
        currentStatus: alert.status,
      });
    }

    const prev = (alert.note ?? '').trim();
    const next = prev ? `${prev}\n\n${trimmed}` : trimmed;
    const capped = next.slice(0, 4000);

    const updated = await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { note: capped },
    });
    this.realtime.emitSosAlert(alert.societyId, updated);
    return updated;
  }

  async acknowledge(alertId: string, staffId: string) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('SOS alert not found');

    const responseTimeSecs = Math.floor(
      (Date.now() - alert.createdAt.getTime()) / 1000,
    );

    return this.prisma.sosAlert.update({
      where: { id: alertId },
      data: {
        status: SosStatus.ACKNOWLEDGED,
        acknowledgedBy: staffId,
        acknowledgedAt: new Date(),
        responseTimeSecs,
      },
    });
  }

  async resolve(alertId: string) {
    return this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { status: SosStatus.RESOLVED, resolvedAt: new Date() },
    });
  }

  /** Resident's own SOS alert history (most recent first). */
  async getHistory(userId: string) {
    const alerts = await this.prisma.sosAlert.findMany({
      where: { residentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return alerts.map((a) => ({
      id: a.id,
      status: a.status,
      note: a.note,
      createdAt: a.createdAt,
      durationSec: a.resolvedAt
        ? Math.max(0, Math.floor((a.resolvedAt.getTime() - a.createdAt.getTime()) / 1000))
        : a.responseTimeSecs ?? null,
    }));
  }

  /**
   * Resident may cancel within SOS_CANCEL_WINDOW_MS (default 5s) while ACTIVE only.
   * Admin / super-admin / staff may mark false alarm while ACTIVE or ACKNOWLEDGED.
   * Terminal states are idempotent: returns the existing row.
   */
  async flagFalseAlarm(alertId: string, actor: JwtPayload) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('SOS alert not found');

    if (alert.status === SosStatus.FALSE_ALARM || alert.status === SosStatus.RESOLVED) {
      return alert;
    }

    const privileged =
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.SUPER_ADMIN ||
      actor.role === UserRole.STAFF;

    if (!privileged) {
      if (alert.residentId !== actor.sub) {
        throw new ForbiddenException({ code: 'SOS_NOT_OWNER', message: 'Only the alerting resident can cancel' });
      }
      if (alert.status !== SosStatus.ACTIVE) {
        throw new ConflictException({
          code: 'SOS_CANCEL_NOT_ALLOWED',
          message: 'Cancel is only allowed while the alert is active',
        });
      }
      const windowMs = parseInt(this.config.get<string>('SOS_CANCEL_WINDOW_MS') ?? '5000', 10);
      const age = Date.now() - alert.createdAt.getTime();
      if (age > windowMs) {
        throw new ConflictException({
          code: 'SOS_CANCEL_WINDOW_EXPIRED',
          message: `Cancel is only allowed within ${windowMs / 1000}s of triggering`,
          retryAfter: 0,
        });
      }
    } else if (alert.status !== SosStatus.ACTIVE && alert.status !== SosStatus.ACKNOWLEDGED) {
      throw new ConflictException({
        code: 'SOS_CANCEL_NOT_ALLOWED',
        message: 'Cannot mark false alarm for this alert state',
        currentStatus: alert.status,
      });
    }

    return this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { status: SosStatus.FALSE_ALARM },
    });
  }

  async getActive(societyId: string) {
    return this.prisma.sosAlert.findMany({
      where: { societyId, status: SosStatus.ACTIVE },
      include: {
        resident: {
          include: {
            resident: { include: { flat: true } },
            staffMember: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Responders config ──────────────────────────────────────────────────────
  // TODO(schema): No SosResponder model and no isSosResponder flag on User.
  // Persisting responder userIds in society.config.sosResponders JSON, mirroring
  // the existing sosRecipients pattern in admin.service.ts. Add a model when
  // responders need richer fields (shifts, etc.).

  private async loadResponderIds(societyId: string): Promise<string[]> {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const cfg = (society.config as Record<string, unknown> | null) ?? {};
    const ids = cfg.sosResponders;
    return Array.isArray(ids) ? (ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  }

  private async saveResponderIds(societyId: string, ids: string[]) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const cfg = (society.config as Record<string, unknown> | null) ?? {};
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...cfg, sosResponders: ids } },
    });
  }

  async listResponders(societyId: string) {
    const ids = await this.loadResponderIds(societyId);
    if (ids.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, societyId },
      select: { id: true, name: true, phone: true, email: true, role: true, status: true },
    });
    return users;
  }

  async addResponder(societyId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.societyId !== societyId) {
      throw new NotFoundException('User not found in this society');
    }
    const allowed: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.BUILDING_ADMIN];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('Only admin or staff users can be SOS responders');
    }
    const ids = await this.loadResponderIds(societyId);
    if (!ids.includes(userId)) {
      ids.push(userId);
      await this.saveResponderIds(societyId, ids);
    }
    return { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role };
  }

  async removeResponder(societyId: string, userId: string) {
    const ids = await this.loadResponderIds(societyId);
    const next = ids.filter((id) => id !== userId);
    await this.saveResponderIds(societyId, next);
    return { deleted: true };
  }
}
