import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getNotificationType,
  isForceOn,
  type NotificationType,
} from './notification-categories';

export interface PushNotificationAction {
  id: string;
  title: string;
  destructive?: boolean;
}

export interface PushNotification {
  title: string;
  body: string;
  /** Category key matched against the NotificationPreference table (default true). */
  category?: string;
  /** Critical messages (e.g. SOS) bypass quiet hours and category opt-out. */
  critical?: boolean;
  /** Optional rich image (Android BigPicture / iOS NSE attachment). */
  imageUrl?: string;
  /** Optional action buttons; rendered client-side from a data-only payload. */
  actions?: PushNotificationAction[];
  /** FCM collapse key (Android) / apns-collapse-id (iOS) for deduping. */
  collapseKey?: string;
  /**
   * When true (or when `actions` are present) the message is sent data-only and
   * high-priority — no top-level `notification` block — so the client builds the
   * notification + action buttons itself.
   */
  dataOnly?: boolean;
}

const QUIET_START_HOUR = 22; // 22:00 IST
const QUIET_END_HOUR = 7; //  07:00 IST

const DEFER_QUEUE = 'push-deferred';

type DeferredJob =
  | {
      kind: 'user';
      userId: string;
      notification: PushNotification;
      data?: Record<string, string>;
    }
  | {
      kind: 'society';
      societyId: string;
      role: string | null;
      notification: PushNotification;
      data?: Record<string, string>;
    };

function istWallClock(now: Date): { y: string; mo: string; d: string; h: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    y: parts.year,
    mo: parts.month,
    d: parts.day,
    h: parseInt(parts.hour, 10),
  };
}

function isInQuietHoursIST(now: Date = new Date()): boolean {
  const { h } = istWallClock(now);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** Milliseconds until next 07:00 Asia/Kolkata (only valid when `isInQuietHoursIST`). */
function msUntilNextQuietEndIST(now: Date): number {
  if (!isInQuietHoursIST(now)) return 0;
  const wc = istWallClock(now);
  const dateStr = `${wc.y}-${wc.mo}-${wc.d}`;
  if (wc.h >= QUIET_START_HOUR) {
    const mid = new Date(`${dateStr}T12:00:00+05:30`);
    mid.setDate(mid.getDate() + 1);
    const y2 = mid.getFullYear();
    const m2 = String(mid.getMonth() + 1).padStart(2, '0');
    const d2 = String(mid.getDate()).padStart(2, '0');
    const target = new Date(`${y2}-${m2}-${d2}T07:00:00+05:30`);
    return Math.max(0, target.getTime() - now.getTime());
  }
  const target = new Date(`${dateStr}T07:00:00+05:30`);
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * FCM-backed push service. Resolves device tokens from Prisma, applies opt-out
 * + quiet-hours rules, cleans up Unregistered tokens, and falls back to SMS for
 * critical messages when push fails (corner case S4 / PN1).
 */
@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;
  private redisConn: IORedis | null = null;
  private deferQueue: Queue | null = null;
  private deferWorker: Worker | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initFirebase();
  }

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return;
    try {
      this.redisConn = new IORedis(url, { maxRetriesPerRequest: null });
      this.deferQueue = new Queue(DEFER_QUEUE, { connection: this.redisConn });
      this.deferWorker = new Worker(
        DEFER_QUEUE,
        async (job) => {
          const payload = job.data as DeferredJob;
          if (payload.kind === 'user') {
            await this.sendNow(payload.userId, payload.notification, payload.data);
          } else {
            await this.sendToSocietyNow(
              payload.societyId,
              payload.role,
              payload.notification,
              payload.data,
            );
          }
        },
        { connection: this.redisConn.duplicate() },
      );
      this.deferWorker.on('failed', (job, err) => {
        this.logger.warn(`deferred push failed job=${job?.id}: ${(err as Error).message}`);
      });
      this.logger.log('Deferred push queue (BullMQ) ready');
    } catch (e) {
      this.logger.warn(`Deferred push queue disabled: ${(e as Error).message}`);
      this.deferQueue = null;
      this.deferWorker = null;
      try {
        await this.redisConn?.quit();
      } catch {
        /* noop */
      }
      this.redisConn = null;
    }
  }

  async onModuleDestroy() {
    try {
      await this.deferWorker?.close();
      await this.deferQueue?.close();
      await this.redisConn?.quit();
    } catch {
      /* noop */
    }
  }

  private initFirebase() {
    if (admin.apps.length) {
      this.initialized = true;
      return;
    }
    try {
      const b64 = this.config.get<string>('FIREBASE_SA_BASE64');
      const inline = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      let raw: string | undefined;
      if (b64) raw = Buffer.from(b64, 'base64').toString('utf-8');
      else if (inline) raw = inline;
      if (!raw) {
        this.logger.warn('Firebase service account not configured; push disabled');
        return;
      }
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
      this.initialized = true;
    } catch (e) {
      this.logger.warn(`Firebase init failed: ${(e as Error).message}`);
    }
  }

  private async enqueueDeferred(job: DeferredJob): Promise<boolean> {
    const delay = msUntilNextQuietEndIST(new Date());
    if (!this.deferQueue || delay <= 0) {
      this.logger.debug('[push] cannot queue deferred push (no Redis queue or delay)');
      return false;
    }
    await this.deferQueue.add('deliver', job, {
      delay,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 50 },
    });
    this.logger.debug(`[push] deferred job=${job.kind} delayMs=${delay}`);
    return true;
  }

  /**
   * All push tokens for a user: every Device.token UNION the legacy
   * `user.fcmToken` (kept as a migration fallback), de-duplicated.
   */
  private async resolveTokens(userId: string): Promise<string[]> {
    const [devices, user] = await Promise.all([
      this.prisma.device.findMany({ where: { userId }, select: { token: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } }),
    ]);
    const tokens = new Set<string>();
    for (const d of devices) if (d.token) tokens.add(d.token);
    if (user?.fcmToken) tokens.add(user.fcmToken);
    return [...tokens];
  }

  /**
   * Whether a user has opted out of a given category.
   *
   * Force-on categories and critical messages are never opted out. Otherwise the
   * NotificationPreference table wins; in its absence we fall back to the legacy
   * `user.notificationPrefs` JSON for migration continuity.
   */
  private async isOptedOut(
    userId: string,
    category?: string,
    critical?: boolean,
  ): Promise<boolean> {
    if (critical === true) return false;
    if (!category) return false;
    if (isForceOn(category)) return false;

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_category: { userId, category } },
      select: { enabled: true },
    });
    if (pref) return !pref.enabled;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = (user?.notificationPrefs as any) || {};
    return prefs[category] === false;
  }

  /**
   * Build the FCM multicast message body for the given tokens. Centralises the
   * simple (top-level notification) vs. data-only (action buttons / rich) modes,
   * SOS channel routing, collapse keys and APNs payload shaping.
   */
  private buildMessage(
    tokens: string[],
    notification: PushNotification,
    data?: Record<string, string>,
  ): admin.messaging.MulticastMessage {
    // Resolve coarse-grained type (MARKETING/DELIVERY/EMERGENCY) from the
    // category key (preferred) or the free-form data.type. `notification.critical`
    // is a hard override — if the caller flagged the push as critical we route
    // through the EMERGENCY pipeline regardless of category.
    const ntype: NotificationType = notification.critical
      ? 'EMERGENCY'
      : getNotificationType(notification.category ?? data?.type);

    // Channel id mirrors the apps' channel registrations (see
    // resident-app/src/lib/push.ts + staff-app/src/lib/notifications.ts).
    // The CHANNEL owns the Android sound + vibration + importance; we do NOT
    // set `notification.sound` on the FCM payload because doing so would
    // override the per-channel sound chosen by the app.
    const channelId =
      ntype === 'EMERGENCY' ? 'emergency_sos'
      : ntype === 'DELIVERY' ? 'deliveries'
      : 'marketing';

    // iOS interruption level: EMERGENCY uses 'critical' (needs the critical-alerts
    // entitlement to actually break through silent mode; harmless otherwise),
    // DELIVERY uses 'time-sensitive' (bypasses Focus modes when the user has
    // granted Time Sensitive Notifications), MARKETING stays 'active' (default).
    const apnsInterruptionLevel: 'critical' | 'time-sensitive' | 'active' =
      ntype === 'EMERGENCY' ? 'critical'
      : ntype === 'DELIVERY' ? 'time-sensitive'
      : 'active';

    // iOS sound: until the apps bundle custom .caf files, every type gets the
    // OS default — differentiation comes from interruption level + apns headers.
    // To wire a custom sound later, replace 'default' below with the bundled
    // filename ('emergency.caf', 'delivery.caf') and add it to the app target's
    // resources via the expo-notifications plugin `sounds` array. See the per-
    // app `assets/sounds/README.md` for the swap-in checklist.
    const apnsSound = ntype === 'MARKETING' ? undefined : 'default';

    const hasActions = !!notification.actions && notification.actions.length > 0;
    const dataOnly = !!notification.dataOnly || hasActions;
    // High FCM priority for anything except MARKETING — DELIVERY + EMERGENCY
    // need to wake the device + show heads-up instead of being batched in doze.
    const highPriority = ntype !== 'MARKETING' || dataOnly;

    const android: admin.messaging.AndroidConfig = {
      priority: highPriority ? 'high' : 'normal',
    };
    const apnsHeaders: Record<string, string> = {};
    if (notification.collapseKey) {
      android.collapseKey = notification.collapseKey;
      apnsHeaders['apns-collapse-id'] = notification.collapseKey;
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      data,
      android,
    };

    // iOS action group id — distinct from the opt-out `category`. Apps register
    // actions via `setNotificationCategoryAsync(<actionGroup>, [...])`, so we use
    // `data.actionGroup` if present (e.g. 'visitor_approval'), otherwise fall
    // back to the opt-out category (legacy behaviour).
    const apnsCategory = (data?.actionGroup as string | undefined) ?? notification.category;

    if (dataOnly) {
      // Data-only: client renders the notification + action buttons. Carry the
      // display fields and serialized actions in the data dictionary.
      const richData: Record<string, string> = { ...(data || {}) };
      richData.title = notification.title;
      richData.body = notification.body;
      richData.channelId = channelId;
      if (notification.imageUrl) richData.imageUrl = notification.imageUrl;
      if (hasActions) richData.actions = JSON.stringify(notification.actions);
      message.data = richData;
      // NOTE: intentionally NO `android.notification` block here — a data-only
      // message must omit it so the client's background handler fires and builds
      // the notification + action buttons (channel id carried in `data`).
      message.android = android;
      message.apns = {
        ...(Object.keys(apnsHeaders).length ? { headers: apnsHeaders } : {}),
        payload: {
          aps: {
            'content-available': 1,
            'mutable-content': 1,
            alert: { title: notification.title, body: notification.body },
            ...(apnsCategory ? { category: apnsCategory } : {}),
            ...(apnsSound ? { sound: apnsSound } : {}),
            'interruption-level': apnsInterruptionLevel,
          },
        },
      };
      return message;
    }

    // Simple message: top-level notification block.
    message.notification = { title: notification.title, body: notification.body };
    message.android = {
      ...android,
      notification: {
        channelId,
        ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
      },
    };
    message.apns = {
      ...(Object.keys(apnsHeaders).length ? { headers: apnsHeaders } : {}),
      payload: {
        aps: {
          ...(apnsCategory ? { category: apnsCategory } : {}),
          ...(apnsSound ? { sound: apnsSound } : {}),
          // iOS interruption level — EMERGENCY uses 'critical' (requires the
          // Apple critical-alerts entitlement to actually break through silent
          // mode; harmless otherwise). DELIVERY uses 'time-sensitive' so it
          // bypasses Focus when the user has granted that to us.
          'interruption-level': apnsInterruptionLevel,
        },
      },
    };
    return message;
  }

  /** Delete Device rows + null matching user.fcmToken for the given invalid tokens. */
  private async cleanupInvalidTokens(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;
    let cleaned = 0;
    const devRes = await this.prisma.device
      .deleteMany({ where: { token: { in: tokens } } })
      .catch(() => null);
    cleaned += devRes?.count || 0;
    const userRes = await this.prisma.user
      .updateMany({ where: { fcmToken: { in: tokens } }, data: { fcmToken: null } })
      .catch(() => null);
    cleaned += userRes?.count || 0;
    return cleaned;
  }

  /** Best-effort audit row; never throws into the send path. */
  private async writeLog(entry: {
    userId?: string | null;
    societyId?: string | null;
    notification: PushNotification;
    data?: Record<string, string>;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
  }): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId: entry.userId ?? null,
          societyId: entry.societyId ?? null,
          category: entry.notification.category ?? 'uncategorized',
          title: entry.notification.title,
          body: entry.notification.body,
          data: (entry.data ?? undefined) as any,
          status: entry.status as any,
          dedupKey: entry.notification.collapseKey ?? null,
          sentAt: entry.status === 'SENT' ? new Date() : null,
        },
      });
    } catch (e) {
      this.logger.debug(`[push] notification log skipped: ${(e as Error).message}`);
    }
  }

  /**
   * Send immediately (quiet-hours and opt-out already honored by caller where needed).
   */
  private async sendNow(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ ok: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };

    if (await this.isOptedOut(userId, notification.category, notification.critical)) {
      await this.writeLog({ userId, notification, data, status: 'SKIPPED' });
      return { ok: false, reason: 'opted_out' };
    }

    const tokens = await this.resolveTokens(userId);
    if (!tokens.length) {
      return { ok: false, reason: 'no_token' };
    }

    if (!this.initialized) {
      return { ok: false, reason: 'firebase_not_initialized' };
    }

    try {
      const message = this.buildMessage(tokens, notification, data);
      const res = await admin.messaging().sendEachForMulticast(message);

      const invalidTokens: string[] = [];
      res.responses.forEach((r, i) => {
        const code = (r.error as any)?.errorInfo?.code || r.error?.message;
        if (
          code &&
          /Unregistered|registration-token-not-registered|invalid-argument/i.test(String(code))
        ) {
          invalidTokens.push(tokens[i]);
        }
      });
      await this.cleanupInvalidTokens(invalidTokens);

      if (res.successCount > 0) {
        await this.writeLog({ userId, notification, data, status: 'SENT' });
        return { ok: true };
      }
      await this.writeLog({ userId, notification, data, status: 'FAILED' });
      return { ok: false, reason: 'all_failed' };
    } catch (err) {
      const code = (err as any)?.errorInfo?.code || (err as Error).message;
      this.logger.warn(`FCM send failed user=${userId}: ${code}`);
      await this.writeLog({ userId, notification, data, status: 'FAILED' });
      return { ok: false, reason: String(code) };
    }
  }

  async send(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ ok: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };

    if (await this.isOptedOut(userId, notification.category, notification.critical)) {
      return { ok: false, reason: 'opted_out' };
    }

    if (!notification.critical && isInQuietHoursIST()) {
      const queued = await this.enqueueDeferred({ kind: 'user', userId, notification, data });
      if (queued) {
        return { ok: true, reason: 'queued_quiet_hours' };
      }
      this.logger.debug(`[push] quiet hours, not queued user=${userId}`);
      return { ok: false, reason: 'quiet_hours' };
    }

    return this.sendNow(userId, notification, data);
  }

  private async sendToSocietyNow(
    societyId: string,
    role: string | null,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number; cleaned: number }> {
    if (!this.initialized) return { sent: 0, failed: 0, cleaned: 0 };

    const where: Record<string, unknown> = { societyId };
    if (role) where.role = role;
    const users = await this.prisma.user.findMany({
      where: where as any,
      select: { id: true, fcmToken: true, notificationPrefs: true },
    });
    if (!users.length) return { sent: 0, failed: 0, cleaned: 0 };

    // Batch eligibility (no per-user queries — avoids N+1 on a society broadcast).
    const category = notification.category;
    const bypass = notification.critical === true || !category || isForceOn(category);
    const userIds = users.map((u) => u.id);

    const prefByUser = new Map<string, boolean>();
    if (!bypass && category) {
      const prefRows = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, category },
        select: { userId: true, enabled: true },
      });
      for (const p of prefRows) prefByUser.set(p.userId, p.enabled);
    }

    const eligibleIds = new Set<string>();
    for (const u of users) {
      if (bypass) {
        eligibleIds.add(u.id);
        continue;
      }
      const pref = prefByUser.get(u.id);
      const optedOut =
        pref !== undefined ? !pref : ((u.notificationPrefs as any) || {})[category!] === false;
      if (!optedOut) eligibleIds.add(u.id);
    }
    if (!eligibleIds.size) return { sent: 0, failed: 0, cleaned: 0 };

    // One query for all device tokens of eligible recipients (+ legacy fcmToken).
    const devices = await this.prisma.device.findMany({
      where: { userId: { in: [...eligibleIds] } },
      select: { token: true },
    });
    const tokenSet = new Set<string>();
    for (const d of devices) if (d.token) tokenSet.add(d.token);
    for (const u of users) if (eligibleIds.has(u.id) && u.fcmToken) tokenSet.add(u.fcmToken);

    const tokens = [...tokenSet];
    if (!tokens.length) return { sent: 0, failed: 0, cleaned: 0 };

    let sent = 0;
    let failed = 0;
    let cleaned = 0;

    const chunks = chunk(tokens, 500);
    for (const c of chunks) {
      try {
        const message = this.buildMessage(c, notification, data);
        const res = await admin.messaging().sendEachForMulticast(message);
        sent += res.successCount;
        failed += res.failureCount;

        const invalidTokens: string[] = [];
        res.responses.forEach((r, i) => {
          const code = (r.error as any)?.errorInfo?.code || r.error?.message;
          if (code && /Unregistered|registration-token-not-registered|invalid-argument/i.test(String(code))) {
            invalidTokens.push(c[i]);
          }
        });
        cleaned += await this.cleanupInvalidTokens(invalidTokens);
      } catch (e) {
        this.logger.warn(`multicast chunk failed: ${(e as Error).message}`);
        failed += c.length;
      }
    }

    await this.writeLog({ societyId, notification, data, status: 'SENT' });
    return { sent, failed, cleaned };
  }

  /**
   * Multicast to all users in a society matching the role filter.
   * Splits into 500-token chunks (FCM hard limit).
   */
  async sendToSociety(
    societyId: string,
    role: string | null,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number; cleaned: number; queued?: boolean }> {
    if (!this.initialized) return { sent: 0, failed: 0, cleaned: 0 };

    if (!notification.critical && isInQuietHoursIST()) {
      const ok = await this.enqueueDeferred({
        kind: 'society',
        societyId,
        role,
        notification,
        data,
      });
      if (ok) {
        return { sent: 0, failed: 0, cleaned: 0, queued: true };
      }
      this.logger.debug(`[push] society quiet-hours not queued society=${societyId}`);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    const r = await this.sendToSocietyNow(societyId, role, notification, data);
    return { ...r, queued: false };
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
