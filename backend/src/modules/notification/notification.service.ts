import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PushService } from '../../common/notification/push.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private config: ConfigService,
    private push: PushService,
    private realtime: RealtimeGateway,
  ) {}

  /**
   * SOS realtime broadcast: hits society admin + gate rooms + first-responder
   * resident rooms simultaneously. FCM (with SMS fallback for stale tokens) is
   * handled separately by `push.sendToSociety` callers.
   */
  broadcastSos(
    societyId: string,
    payload: { alertId: string; residentName: string; lat?: number; lng?: number },
    firstResponderUserIds: string[] = [],
  ) {
    const rooms = [
      `society:${societyId}:admin`,
      `society:${societyId}:gate`,
      ...firstResponderUserIds.map((uid) => `society:${societyId}:resident:${uid}`),
    ];
    this.realtime.emitMany(rooms, 'sos:triggered', payload);
  }

  /** Notify a user via FCM with SMS fallback for critical messages. */
  notifyUser(
    userId: string,
    title: string,
    body: string,
    opts?: { category?: string; critical?: boolean; data?: Record<string, string> },
  ) {
    return this.push.send(
      userId,
      { title, body, category: opts?.category, critical: opts?.critical },
      opts?.data,
    );
  }

  async sendToToken(fcmToken: string, payload: PushPayload) {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (err) {
      this.logger.warn(`FCM send failed for token ${fcmToken}: ${err}`);
    }
  }

  async sendToMultiple(fcmTokens: string[], payload: PushPayload) {
    const chunks = this.chunkArray(fcmTokens, 500);
    for (const chunk of chunks) {
      try {
        await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        this.logger.warn(`FCM multicast failed: ${err}`);
      }
    }
  }

  async sendSosAlert(fcmTokens: string[], alertId: string, residentName: string) {
    await this.sendToMultiple(fcmTokens, {
      title: '🚨 Medical SOS Alert',
      body: `${residentName} has triggered a medical emergency`,
      data: { type: 'SOS', alertId },
    });
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}
