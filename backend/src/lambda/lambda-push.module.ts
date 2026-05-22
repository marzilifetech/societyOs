import { Global, Injectable, Logger, Module } from '@nestjs/common';
import {
  PushService,
  type PushNotification,
} from '../common/notification/push.service';

// Lambda-side push registration.
//
// The real `PushService` boots Firebase Admin SDK + BullMQ workers — too heavy
// for Lambda and pointless because Lambdas shouldn't hold worker processes.
// Per plan §4, Lambdas should publish to SQS (`notifications-immediate` /
// `notifications-delayed`); the `notifications-out` Lambda consumes those and
// calls FCM/MSG91/WhatsApp.
//
// For now this is a no-op stub that logs the intent — proves the DI seam.
// FOLLOW-UP: replace `send` / `sendToSociety` with an `@aws-sdk/client-sqs`
// publish to the immediate queue.
@Injectable()
class LambdaPushService {
  private readonly logger = new Logger('LambdaPushService');

  async send(
    userId: string,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ ok: boolean; reason?: string }> {
    this.logger.debug(
      `[push stub] enqueue send userId=${userId} title=${notification.title} data=${JSON.stringify(data ?? {})}`,
    );
    return { ok: true, reason: 'stub' };
  }

  async sendToSociety(
    societyId: string,
    role: string | null,
    notification: PushNotification,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number; cleaned: number; queued?: boolean }> {
    this.logger.debug(
      `[push stub] enqueue sendToSociety society=${societyId} role=${role} title=${notification.title} data=${JSON.stringify(data ?? {})}`,
    );
    return { sent: 0, failed: 0, cleaned: 0, queued: true };
  }
}

@Global()
@Module({
  providers: [{ provide: PushService, useClass: LambdaPushService }],
  exports: [PushService],
})
export class LambdaPushModule {}
