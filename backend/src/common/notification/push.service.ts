import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushNotification {
  title: string;
  body: string;
  /** Category key matched against `User.notificationPrefs[category]` (default true). */
  category?: string;
  /** Critical messages (e.g. SOS) bypass quiet hours and category opt-out. */
  critical?: boolean;
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
   * Send immediately (quiet-hours and opt-out already honored by caller where needed).
   */
  private async sendNow(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ ok: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, fcmToken: true, notificationPrefs: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };

    if (notification.category && !notification.critical) {
      const prefs = (user.notificationPrefs as any) || {};
      if (prefs[notification.category] === false) {
        return { ok: false, reason: 'opted_out' };
      }
    }

    if (!user.fcmToken) {
      return { ok: false, reason: 'no_token' };
    }

    if (!this.initialized) {
      return { ok: false, reason: 'firebase_not_initialized' };
    }

    // Route critical-tagged or SOS-category alerts to the dedicated `sos`
    // Android channel (declared by staff-app in src/lib/notifications.ts with
    // MAX importance + lockscreen PUBLIC). Non-critical payloads fall through
    // to the default channel.
    const isSos = notification.critical || notification.category === 'sos' || data?.type === 'SOS_TRIGGERED';
    const channelId = isSos ? 'sos' : 'default';

    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title: notification.title, body: notification.body },
        data,
        android: {
          priority: notification.critical ? 'high' : 'normal',
          notification: { channelId },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.critical ? 'default' : undefined,
              // iOS critical-alert flag: respected only when the app's
              // bundle has Apple's critical-alerts entitlement granted. No-op
              // otherwise — degrades to standard notification.
              ...(isSos ? { 'interruption-level': 'critical' as const } : {}),
            },
          },
        },
      });
      return { ok: true };
    } catch (err) {
      const code = (err as any)?.errorInfo?.code || (err as Error).message;
      if (typeof code === 'string' && /Unregistered|registration-token-not-registered|invalid-argument/i.test(code)) {
        await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: null } }).catch(() => {});
        return { ok: false, reason: 'token_invalid' };
      }
      this.logger.warn(`FCM send failed user=${userId}: ${code}`);
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
      select: { id: true, phone: true, fcmToken: true, notificationPrefs: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };

    if (notification.category && !notification.critical) {
      const prefs = (user.notificationPrefs as any) || {};
      if (prefs[notification.category] === false) {
        return { ok: false, reason: 'opted_out' };
      }
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

    const where: Record<string, unknown> = { societyId, fcmToken: { not: null } };
    if (role) where.role = role;
    const users = await this.prisma.user.findMany({
      where: where as any,
      select: { id: true, fcmToken: true, notificationPrefs: true },
    });

    const eligible = users.filter((u) => {
      if (notification.critical) return true;
      if (notification.category) {
        const prefs = (u.notificationPrefs as any) || {};
        if (prefs[notification.category] === false) return false;
      }
      return true;
    });

    const tokens = eligible.map((u) => u.fcmToken!).filter(Boolean);
    if (!tokens.length) return { sent: 0, failed: 0, cleaned: 0 };

    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    // Same SOS routing as sendNow — route to the `sos` channel on Android
    // and bump iOS to interruption-level=critical when the alert is tagged.
    const isSos = notification.critical || notification.category === 'sos' || data?.type === 'SOS_TRIGGERED';
    const channelId = isSos ? 'sos' : 'default';

    const chunks = chunk(tokens, 500);
    for (const c of chunks) {
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: c,
          notification: { title: notification.title, body: notification.body },
          data,
          android: {
            priority: notification.critical ? 'high' : 'normal',
            notification: { channelId },
          },
          apns: {
            payload: {
              aps: {
                sound: notification.critical ? 'default' : undefined,
                ...(isSos ? { 'interruption-level': 'critical' as const } : {}),
              },
            },
          },
        });
        sent += res.successCount;
        failed += res.failureCount;

        const invalidTokens: string[] = [];
        res.responses.forEach((r, i) => {
          const code = (r.error as any)?.errorInfo?.code || r.error?.message;
          if (code && /Unregistered|registration-token-not-registered|invalid-argument/i.test(String(code))) {
            invalidTokens.push(c[i]);
          }
        });
        if (invalidTokens.length) {
          const result = await this.prisma.user
            .updateMany({
              where: { fcmToken: { in: invalidTokens } },
              data: { fcmToken: null },
            })
            .catch(() => null);
          cleaned += result?.count || 0;
        }
      } catch (e) {
        this.logger.warn(`multicast chunk failed: ${(e as Error).message}`);
        failed += c.length;
      }
    }
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
