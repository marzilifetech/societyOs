import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import IORedis from 'ioredis';
import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getCategory,
  getNotificationType,
  isForceOn,
  type NotificationType,
} from './notification-categories';

/**
 * Outcome of a single-recipient send.
 *
 * `ok:false` no longer implies the recipient got nothing: when there is no
 * device token (or FCM is unconfigured) the message is still written to the
 * in-app inbox and `deliveredInApp` is set, so callers can report
 * "delivered in-app" instead of a bare failure.
 */
export interface PushSendResult {
  ok: boolean;
  reason?: string;
  /** True when the message reached the in-app inbox despite no push delivery. */
  deliveredInApp?: boolean;
}

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

/** Approvals/deliveries are pointless after ~30 min — let FCM/APNs drop them. */
const ACTIONABLE_TTL_MS = 30 * 60 * 1000;

/**
 * Society fan-outs up to this many recipients get one message per recipient so
 * each device carries its own unread badge; bigger broadcasts fall back to flat
 * 500-token multicast chunks with no badge (perf).
 */
const SOCIETY_BADGE_MAX_RECIPIENTS = 200;

type DeferredJob =
  | {
      kind: 'user';
      userId: string;
      notification: PushNotification;
      data?: Record<string, string>;
      /** DEFERRED NotificationLog row written at defer time; reconciled on delivery. */
      logId?: string | null;
    }
  | {
      kind: 'society';
      societyId: string;
      role: string | null;
      notification: PushNotification;
      data?: Record<string, string>;
      /** DEFERRED NotificationLog row written at defer time; reconciled on delivery. */
      logId?: string | null;
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
      // bullmq bundles its own ioredis types, so the app's IORedis instance is
      // structurally identical but nominally incompatible — cast is safe.
      const connection = this.redisConn as unknown as ConnectionOptions;
      this.deferQueue = new Queue(DEFER_QUEUE, { connection });
      this.deferWorker = new Worker(
        DEFER_QUEUE,
        async (job) => {
          const payload = job.data as DeferredJob;
          if (payload.kind === 'user') {
            await this.sendNow(
              payload.userId,
              payload.notification,
              payload.data,
              payload.logId ?? undefined,
            );
          } else {
            await this.sendToSocietyNow(
              payload.societyId,
              payload.role,
              payload.notification,
              payload.data,
              payload.logId ?? undefined,
            );
          }
        },
        { connection: this.redisConn.duplicate() as unknown as ConnectionOptions },
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

  /**
   * Queue a quiet-hours push for delivery at 07:00 IST. Writes a DEFERRED
   * NotificationLog row first (inbox visibility while the push waits) and
   * threads its id through the job so the worker reconciles it on delivery.
   * Returns false when the queue is unavailable — callers then DROP the
   * non-critical push (quiet hours stay enforced even without Redis).
   */
  private async enqueueDeferred(job: DeferredJob): Promise<boolean> {
    const delay = msUntilNextQuietEndIST(new Date());
    if (!this.deferQueue || delay <= 0) {
      this.logger.debug('[push] cannot queue deferred push (no Redis queue or delay)');
      return false;
    }
    const logId = await this.writeLog({
      userId: job.kind === 'user' ? job.userId : null,
      societyId: job.kind === 'society' ? job.societyId : null,
      notification: job.notification,
      data: job.data,
      status: 'DEFERRED',
    });
    try {
      await this.deferQueue.add(
        'deliver',
        { ...job, logId: logId ?? undefined },
        {
          delay,
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 50 },
        },
      );
    } catch (e) {
      this.logger.warn(`[push] defer queue unavailable: ${(e as Error).message}`);
      if (logId) {
        // The push is dropped (quiet hours enforced) — remove the DEFERRED row
        // so it doesn't linger forever inflating badge counts / the inbox.
        await this.prisma.notificationLog.delete({ where: { id: logId } }).catch(() => undefined);
      }
      return false;
    }
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
    opts?: { badge?: number },
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
    // Registry categories carry an explicit channelId; anything else falls
    // back to the coarse-type mapping ('community' replaced the legacy
    // 'marketing' channel — the apps no longer register the latter).
    const category = notification.category ? getCategory(notification.category) : undefined;
    const channelId: string = notification.critical
      ? 'emergency_sos'
      : category?.channelId ??
        (ntype === 'EMERGENCY' ? 'emergency_sos'
        : ntype === 'DELIVERY' ? 'deliveries'
        : 'community');

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

    // Time-boxed relevance: an approval/delivery prompt is useless after ~30
    // minutes, so let FCM/APNs expire it instead of waking the user later.
    // SOS and community-style pushes keep the platform default (no expiry).
    if (channelId === 'approvals' || channelId === 'deliveries') {
      android.ttl = ACTIONABLE_TTL_MS;
      apnsHeaders['apns-expiration'] = String(
        Math.floor((Date.now() + ACTIONABLE_TTL_MS) / 1000),
      );
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
      // Android tray-stack group (analog of the iOS thread-id below). FCM v1
      // has NO android.notification.group field — the v1 API rejects unknown
      // names — so the group rides in `data` for the client-side renderer.
      richData.group = channelId;
      if (notification.imageUrl) richData.imageUrl = notification.imageUrl;
      if (hasActions) richData.actions = JSON.stringify(notification.actions);
      message.data = richData;
      // A backgrounded/killed Android app never gets to run the JS handler for
      // a pure data message in time, which made actionable pushes (visitor /
      // delivery / help / task approvals) invisible until the next app-open.
      // Ship a real tray notification alongside the FULL data payload — the
      // foreground client still renders the rich notification + action buttons
      // itself and dedupes via the collapse key.
      message.android = {
        ...android,
        notification: {
          channelId,
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
          ...(opts?.badge !== undefined ? { notificationCount: opts.badge } : {}),
        },
      };
      message.apns = {
        ...(Object.keys(apnsHeaders).length ? { headers: apnsHeaders } : {}),
        payload: {
          aps: {
            'content-available': 1,
            'mutable-content': 1,
            alert: { title: notification.title, body: notification.body },
            ...(apnsCategory ? { category: apnsCategory } : {}),
            ...(apnsSound ? { sound: apnsSound } : {}),
            ...(opts?.badge !== undefined ? { badge: opts.badge } : {}),
            // Group the notification-center stack per Android channel bucket.
            'thread-id': channelId,
            'interruption-level': apnsInterruptionLevel,
          },
        },
      };
      return message;
    }

    // Simple message: top-level notification block.
    message.notification = { title: notification.title, body: notification.body };
    // Android tray-stack group (analog of the iOS thread-id below). FCM v1 has
    // NO android.notification.group field — the v1 API rejects unknown names —
    // so the group rides in `data` for the client-side renderer.
    message.data = { ...(data ?? {}), group: channelId };
    message.android = {
      ...android,
      notification: {
        channelId,
        ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
        ...(opts?.badge !== undefined ? { notificationCount: opts.badge } : {}),
      },
    };
    message.apns = {
      ...(Object.keys(apnsHeaders).length ? { headers: apnsHeaders } : {}),
      payload: {
        aps: {
          ...(apnsCategory ? { category: apnsCategory } : {}),
          ...(apnsSound ? { sound: apnsSound } : {}),
          ...(opts?.badge !== undefined ? { badge: opts.badge } : {}),
          // Group the notification-center stack per Android channel bucket.
          'thread-id': channelId,
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

  /**
   * NotificationLog.type — the deep-link key both app inboxes switch on.
   * Prefers the registry category key passed to send(), then the legacy
   * free-form data.type, then the coarse pipeline type.
   */
  private resolveLogType(
    notification: PushNotification,
    data?: Record<string, string>,
  ): string {
    return (
      notification.category ?? data?.type ?? (notification.critical ? 'EMERGENCY' : 'MARKETING')
    );
  }

  /**
   * Best-effort audit/inbox row; never throws into the send path. Returns the
   * row id (threaded through deferred jobs for reconciliation) or null. When
   * `id` is set, the DEFERRED row written at defer time is updated in place
   * instead of inserting a duplicate.
   */
  private async writeLog(entry: {
    id?: string | null;
    userId?: string | null;
    societyId?: string | null;
    notification: PushNotification;
    data?: Record<string, string>;
    status: 'SENT' | 'FAILED' | 'SKIPPED' | 'DEFERRED';
  }): Promise<string | null> {
    if (entry.id) {
      try {
        await this.prisma.notificationLog.update({
          where: { id: entry.id },
          data: {
            status: entry.status as any,
            sentAt: entry.status === 'SENT' ? new Date() : null,
          },
        });
        return entry.id;
      } catch {
        /* deferred row vanished — fall through to a fresh insert */
      }
    }
    try {
      const row = await this.prisma.notificationLog.create({
        data: {
          userId: entry.userId ?? null,
          societyId: entry.societyId ?? null,
          category: entry.notification.category ?? 'uncategorized',
          type: this.resolveLogType(entry.notification, entry.data),
          title: entry.notification.title,
          body: entry.notification.body,
          data: (entry.data ?? undefined) as any,
          status: entry.status as any,
          dedupKey: entry.notification.collapseKey ?? null,
          sentAt: entry.status === 'SENT' ? new Date() : null,
        },
      });
      return row?.id ?? null;
    } catch (e) {
      this.logger.debug(`[push] notification log skipped: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Mark a DEFERRED inbox row as SKIPPED when delivery can't proceed (user
   * gone, no tokens, Firebase down, empty fan-out). Both badge queries count
   * status DEFERRED, so leaving the row untouched would inflate every future
   * badge for that user forever and leave a phantom inbox entry.
   */
  private async reconcileDeferredSkipped(deferredLogId?: string): Promise<void> {
    if (!deferredLogId) return;
    await this.prisma.notificationLog
      .update({ where: { id: deferredLogId }, data: { status: 'SKIPPED' as any } })
      .catch(() => undefined);
  }

  /**
   * Send immediately (quiet-hours and opt-out already honored by caller where needed).
   */
  private async sendNow(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
    deferredLogId?: string,
  ): Promise<PushSendResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) {
      await this.reconcileDeferredSkipped(deferredLogId);
      return { ok: false, reason: 'user_not_found' };
    }

    if (await this.isOptedOut(userId, notification.category, notification.critical)) {
      await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'SKIPPED' });
      return { ok: false, reason: 'opted_out' };
    }

    const tokens = await this.resolveTokens(userId);
    if (!tokens.length) {
      // No device token does NOT mean "throw the message away". Previously the
      // whole notification vanished — no push AND no inbox row — so a
      // maintenance reminder to a resident who had not enabled push simply
      // never existed. Persist it so it lands in the in-app inbox and the
      // recipient sees it next time they open the app.
      await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'SENT' });
      return { ok: false, reason: 'no_token', deliveredInApp: true };
    }

    if (!this.initialized) {
      // Same reasoning as `no_token`: an unconfigured/unavailable FCM must not
      // silently discard the message.
      await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'SENT' });
      return { ok: false, reason: 'firebase_not_initialized', deliveredInApp: true };
    }

    // OS badge = the recipient's unread inbox count. +1 for this push (its log
    // row is written after the send); the DEFERRED row from quiet hours, if
    // any, already represents this push, so exclude it from the count.
    const unread = await this.prisma.notificationLog
      .count({
        where: {
          userId,
          readAt: null,
          status: { in: ['SENT', 'DEFERRED'] },
          ...(deferredLogId ? { id: { not: deferredLogId } } : {}),
        },
      })
      .catch(() => null);
    const badge = unread === null ? undefined : unread + 1;

    try {
      const message = this.buildMessage(tokens, notification, data, { badge });
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
        await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'SENT' });
        return { ok: true };
      }
      await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'FAILED' });
      return { ok: false, reason: 'all_failed' };
    } catch (err) {
      const code = (err as any)?.errorInfo?.code || (err as Error).message;
      this.logger.warn(`FCM send failed user=${userId}: ${code}`);
      await this.writeLog({ id: deferredLogId, userId, notification, data, status: 'FAILED' });
      return { ok: false, reason: String(code) };
    }
  }

  /**
   * Whether a push must be delivered IMMEDIATELY even during quiet hours.
   * Beyond `critical` (SOS), this covers:
   *   - ACTIONABLE approvals (gate/visitor/delivery) — a guard is physically
   *     waiting at the gate; deferring the resident's approval prompt to 07:00
   *     defeats the entire feature.
   *   - Force-on "always on" categories (e.g. urgent water/power/safety
   *     notices) — these are explicitly not opt-out-able and must not sit in a
   *     defer queue overnight.
   * Ordinary community/marketing pushes still respect quiet hours.
   */
  private isTimeSensitive(notification: PushNotification): boolean {
    if (notification.critical) return true;
    const cat = notification.category ? getCategory(notification.category) : undefined;
    if (cat?.actionable) return true;
    if (notification.category && isForceOn(notification.category)) return true;
    return false;
  }

  async send(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<PushSendResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };

    if (await this.isOptedOut(userId, notification.category, notification.critical)) {
      return { ok: false, reason: 'opted_out' };
    }

    if (!this.isTimeSensitive(notification) && isInQuietHoursIST()) {
      const queued = await this.enqueueDeferred({ kind: 'user', userId, notification, data });
      if (queued) {
        return { ok: true, reason: 'queued_quiet_hours' };
      }
      // Queue unavailable (Redis down / not configured). Dropping a
      // notification is worse than a late-night buzz, and time-sensitive
      // pushes already bypass this path — so fall through to an immediate
      // send rather than losing it entirely.
      this.logger.warn(
        `[push] quiet-hours queue unavailable, sending immediately user=${userId}`,
      );
      return this.sendNow(userId, notification, data);
    }

    return this.sendNow(userId, notification, data);
  }

  private async sendToSocietyNow(
    societyId: string,
    role: string | null,
    notification: PushNotification,
    data?: Record<string, string>,
    deferredLogId?: string,
  ): Promise<{ sent: number; failed: number; cleaned: number }> {
    if (deferredLogId) {
      // Idempotency guard: BullMQ redelivers stalled/crashed deferred jobs, and
      // the per-recipient fan-out below has no unique key, so a re-run would
      // duplicate every recipient's inbox row and re-send every push.
      // Atomically claim the DEFERRED summary row; a redelivery finds it
      // already claimed and bails out.
      const claimed = await this.prisma.notificationLog
        .updateMany({
          where: { id: deferredLogId, status: 'DEFERRED' as any },
          data: { status: 'SENT' as any, sentAt: new Date() },
        })
        .catch(() => null);
      if (claimed && claimed.count === 0) {
        this.logger.warn(
          `[push] deferred society fan-out log=${deferredLogId} already claimed; skipping redelivery`,
        );
        return { sent: 0, failed: 0, cleaned: 0 };
      }
    }

    if (!this.initialized) {
      await this.reconcileDeferredSkipped(deferredLogId);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    const where: Record<string, unknown> = { societyId };
    if (role) where.role = role;
    const users = await this.prisma.user.findMany({
      where: where as any,
      select: { id: true, fcmToken: true, notificationPrefs: true },
    });
    if (!users.length) {
      await this.reconcileDeferredSkipped(deferredLogId);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

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
    if (!eligibleIds.size) {
      await this.reconcileDeferredSkipped(deferredLogId);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    const recipientIds = [...eligibleIds];

    // One query for all device tokens of eligible recipients (+ legacy fcmToken),
    // grouped per user so small fan-outs can carry per-recipient badges.
    const devices = await this.prisma.device.findMany({
      where: { userId: { in: recipientIds } },
      select: { userId: true, token: true },
    });
    const tokensByUser = new Map<string, Set<string>>();
    const addToken = (uid: string, token: string | null | undefined) => {
      if (!token) return;
      let set = tokensByUser.get(uid);
      if (!set) tokensByUser.set(uid, (set = new Set()));
      set.add(token);
    };
    for (const d of devices) addToken(d.userId, d.token);
    for (const u of users) if (eligibleIds.has(u.id)) addToken(u.id, u.fcmToken);

    const tokenSet = new Set<string>();
    for (const set of tokensByUser.values()) for (const t of set) tokenSet.add(t);
    const tokens = [...tokenSet];
    if (!tokens.length) {
      await this.reconcileDeferredSkipped(deferredLogId);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    let sent = 0;
    let failed = 0;
    let cleaned = 0;

    const dispatch = async (batchTokens: string[], badge?: number) => {
      try {
        const message = this.buildMessage(batchTokens, notification, data, { badge });
        const res = await admin.messaging().sendEachForMulticast(message);
        sent += res.successCount;
        failed += res.failureCount;

        const invalidTokens: string[] = [];
        res.responses.forEach((r, i) => {
          const code = (r.error as any)?.errorInfo?.code || r.error?.message;
          if (code && /Unregistered|registration-token-not-registered|invalid-argument/i.test(String(code))) {
            invalidTokens.push(batchTokens[i]);
          }
        });
        cleaned += await this.cleanupInvalidTokens(invalidTokens);
      } catch (e) {
        this.logger.warn(`multicast chunk failed: ${(e as Error).message}`);
        failed += batchTokens.length;
      }
    };

    if (recipientIds.length <= SOCIETY_BADGE_MAX_RECIPIENTS) {
      // Small fan-out: one message per recipient so every device carries its
      // own unread badge. One grouped count query for all recipients (not N).
      const unreadByUser = new Map<string, number>();
      try {
        const grouped = await this.prisma.notificationLog.groupBy({
          by: ['userId'],
          where: {
            userId: { in: recipientIds },
            readAt: null,
            status: { in: ['SENT', 'DEFERRED'] },
          },
          _count: { _all: true },
        });
        for (const g of grouped) if (g.userId) unreadByUser.set(g.userId, g._count._all);
      } catch (e) {
        this.logger.debug(`[push] badge count skipped: ${(e as Error).message}`);
      }

      const withTokens = recipientIds.filter((uid) => tokensByUser.get(uid)?.size);
      for (const batch of chunk(withTokens, 20)) {
        await Promise.all(
          batch.map((uid) =>
            // +1: the fan-out log row for this push is written after the send.
            dispatch([...tokensByUser.get(uid)!], (unreadByUser.get(uid) ?? 0) + 1),
          ),
        );
      }
    } else {
      // Large broadcast: flat 500-token chunks (FCM hard limit), no badge.
      for (const c of chunk(tokens, 500)) {
        await dispatch(c);
      }
    }

    // Per-recipient inbox rows — the userId=null summary row below never
    // matches the inbox query (it filters on userId), which used to make
    // society broadcasts invisible in the in-app inbox.
    const logType = this.resolveLogType(notification, data);
    const sentAt = new Date();
    for (const idsChunk of chunk(recipientIds, 500)) {
      try {
        await this.prisma.notificationLog.createMany({
          data: idsChunk.map((uid) => ({
            userId: uid,
            societyId,
            category: notification.category ?? 'uncategorized',
            type: logType,
            title: notification.title,
            body: notification.body,
            data: (data ?? undefined) as any,
            status: 'SENT' as any,
            dedupKey: notification.collapseKey ?? null,
            sentAt,
          })),
        });
      } catch (e) {
        this.logger.debug(`[push] fan-out log chunk skipped: ${(e as Error).message}`);
      }
    }

    // Society-level audit summary (userId=null → never surfaces in an inbox);
    // reconciles the DEFERRED row when this ran off the quiet-hours queue.
    await this.writeLog({ id: deferredLogId, societyId, notification, data, status: 'SENT' });
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

    if (!this.isTimeSensitive(notification) && isInQuietHoursIST()) {
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
      // Queue unavailable (Redis down / not configured). Rather than dropping
      // the broadcast, send it immediately — time-sensitive/urgent broadcasts
      // already bypass this path, so only ordinary community pushes land here
      // and a late-night delivery beats losing it.
      this.logger.warn(
        `[push] quiet-hours queue unavailable, sending broadcast immediately society=${societyId}`,
      );
      const r = await this.sendToSocietyNow(societyId, role, notification, data);
      return { ...r, queued: false };
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
