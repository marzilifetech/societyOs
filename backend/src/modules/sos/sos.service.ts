import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway, SOS_RESPONDER_ROLES } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';
import { SosStatus, UserRole } from '@prisma/client';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

/** Staff and admins respond to an alert; anyone else may act only on their own. */
function isResponder(actor: Pick<JwtPayload, 'role'>): boolean {
  return SOS_RESPONDER_ROLES.includes(String(actor.role));
}

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

    // Who raised it and where, so a guard can run to the right flat from the
    // lockscreen without opening anything. Best-effort: never delay the alert.
    const who = await this.describeRaiser(userId).catch(() => null);
    const isStaff = kind === 'staff';
    const title = isStaff ? 'Staff SOS alert' : 'SOS Alert!';
    const place = who?.flat ? ` at ${who.flat}` : '';
    const name = who?.name ? `${who.name}${place}` : place ? `Someone${place}` : '';
    const body = name
      ? `${name} needs help now. Tap to respond.`
      : isStaff
        ? 'A staff member has triggered an emergency SOS. Tap to respond.'
        : 'An emergency SOS has been triggered in your society. Tap to respond.';
    const data: Record<string, string> = {
      type: 'SOS_TRIGGERED',
      entityId: alert.id,
      alertId: alert.id,
      kind,
      ...(who?.name ? { raisedByName: who.name } : {}),
      ...(who?.flat ? { flat: who.flat } : {}),
    };

    // Admins (including building admins) and on-duty staff (guards are role
    // STAFF — there is no SECURITY role), in parallel. The admin send used to
    // be AWAITED before the guards' send even started, which only added
    // latency, and BUILDING_ADMIN was never notified at all. Critical: bypasses
    // quiet hours and opt-out. Never blocks or fails the trigger.
    void Promise.allSettled([
      this.push.sendToSociety(
        societyId,
        [UserRole.ADMIN, UserRole.BUILDING_ADMIN],
        { title, body, critical: true, category: 'emergency_sos', collapseKey: `sos:${alert.id}` },
        data,
      ),
      this.push.sendToSociety(
        societyId,
        UserRole.STAFF,
        { title, body, critical: true, category: 'emergency_sos', collapseKey: `sos:${alert.id}` },
        data,
      ),
    ]);

    return alert;
  }

  /** "Name" and "A-101" for the person who raised an alert. */
  private async describeRaiser(userId: string): Promise<{ name?: string; flat?: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        resident: { select: { flat: { select: { block: true, number: true } } } },
      },
    });
    if (!user) return null;
    const f = user.resident?.flat;
    return {
      name: user.name ?? undefined,
      flat: f ? [f.block, f.number].filter(Boolean).join('-') : undefined,
    };
  }

  /** The alert, scoped to the caller's society — never another society's. */
  private async findInSociety(alertId: string, societyId: string) {
    const alert = await this.prisma.sosAlert.findFirst({ where: { id: alertId, societyId } });
    if (!alert) throw new NotFoundException('SOS alert not found');
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

  /**
   * A responder takes the alert. Scoped to the caller's society (any
   * authenticated user from any society could silence any SOS before), and
   * first-come: when two guards tap at once the first acknowledgement stands
   * and the second gets the alert back as it is.
   */
  async acknowledge(alertId: string, responderId: string, societyId: string) {
    const alert = await this.findInSociety(alertId, societyId);
    if (alert.status === SosStatus.ACKNOWLEDGED) return alert;
    if (alert.status !== SosStatus.ACTIVE) {
      throw new ConflictException({
        code: 'SOS_NOT_ACTIVE',
        message: 'This alert is already closed',
        currentStatus: alert.status,
      });
    }

    const responseTimeSecs = Math.floor((Date.now() - alert.createdAt.getTime()) / 1000);
    await this.prisma.sosAlert.updateMany({
      where: { id: alertId, societyId, status: SosStatus.ACTIVE },
      data: {
        status: SosStatus.ACKNOWLEDGED,
        acknowledgedBy: responderId,
        acknowledgedAt: new Date(),
        responseTimeSecs,
      },
    });
    const updated = await this.findInSociety(alertId, societyId);
    // The sender's screen flips to "Help is coming".
    this.realtime.emitSosToOwner(societyId, updated.residentId, `sos:${alertId}:acknowledged`, {
      alertId,
      acknowledged: true,
      acknowledgedAt: updated.acknowledgedAt,
    });
    return updated;
  }

  /**
   * Close an alert. Scoped to the caller's society; closing twice is a no-op.
   * Responders may close any alert; anyone else only their own. (The person
   * who raised it got a 403 on "Mark as resolved", so guards kept seeing an
   * emergency that was over.)
   */
  async resolve(alertId: string, societyId: string, actor?: Pick<JwtPayload, 'sub' | 'role'>) {
    const alert = await this.findInSociety(alertId, societyId);
    if (actor && !isResponder(actor) && alert.residentId !== actor.sub) {
      throw new ForbiddenException({ code: 'SOS_NOT_OWNER', message: 'Only the person who sent this SOS can close it' });
    }
    if (alert.status === SosStatus.RESOLVED || alert.status === SosStatus.FALSE_ALARM) return alert;
    const updated = await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { status: SosStatus.RESOLVED, resolvedAt: new Date() },
    });
    this.announceClosed(updated);
    return updated;
  }

  /** Tell responders and the sender that an alert is no longer open. */
  private announceClosed(alert: { id: string; societyId: string; residentId: string; status: SosStatus }) {
    this.realtime.emitSosAlert(alert.societyId, alert);
    this.realtime.emitSosToOwner(alert.societyId, alert.residentId, `sos:${alert.id}:closed`, {
      alertId: alert.id,
      status: alert.status,
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
   * Cancel an alert as a false alarm, while it is ACTIVE or ACKNOWLEDGED.
   * Responders may cancel any alert in their society, the sender their own.
   * The sender used to be limited to the first 5 seconds, and the app (which
   * counts down before sending) showed "Cancelled" while the alert stayed
   * open. Terminal states are idempotent: returns the existing row.
   */
  async flagFalseAlarm(alertId: string, actor: JwtPayload, societyId: string) {
    // Scoped to the caller's society: staff and admins are "privileged" here,
    // and used to be privileged over every society's alerts.
    const alert = await this.findInSociety(alertId, societyId);

    if (alert.status === SosStatus.FALSE_ALARM || alert.status === SosStatus.RESOLVED) {
      return alert;
    }

    if (!isResponder(actor) && alert.residentId !== actor.sub) {
      throw new ForbiddenException({ code: 'SOS_NOT_OWNER', message: 'Only the alerting resident can cancel' });
    }
    if (alert.status !== SosStatus.ACTIVE && alert.status !== SosStatus.ACKNOWLEDGED) {
      throw new ConflictException({
        code: 'SOS_CANCEL_NOT_ALLOWED',
        message: 'Cannot mark false alarm for this alert state',
        currentStatus: alert.status,
      });
    }

    const updated = await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { status: SosStatus.FALSE_ALARM },
    });
    this.announceClosed(updated);
    return updated;
  }

  /**
   * Open alerts for responders: ACTIVE and ACKNOWLEDGED (acknowledged is still
   * an emergency in progress — returning ACTIVE only made an alert vanish from
   * the admin console the moment someone acknowledged it, so it could never be
   * marked resolved).
   *
   * Only what a responder needs about the person: name, phone (to call them),
   * role and flat. This used to `include` whole User rows — TOTP secret, FCM
   * token, DOB, email — and the route had no role guard, so any resident could
   * read them.
   */
  async getActive(societyId: string) {
    return this.prisma.sosAlert.findMany({
      where: { societyId, status: { in: [SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED] } },
      select: {
        id: true,
        status: true,
        lat: true,
        lng: true,
        note: true,
        createdAt: true,
        acknowledgedAt: true,
        acknowledgedBy: true,
        responseTimeSecs: true,
        resident: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            resident: { select: { flat: { select: { block: true, number: true } } } },
            staffMember: { select: { designation: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
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
