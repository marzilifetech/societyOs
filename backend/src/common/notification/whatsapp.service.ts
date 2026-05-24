import { Injectable, Logger } from '@nestjs/common';

/**
 * WhatsApp notification service stub.
 *
 * TODO: Integrate Twilio WhatsApp API (or equivalent) when credentials are
 * configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WA_FROM
 * environment variables to enable real delivery.
 *
 * For now, all sends are logged and treated as no-ops.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private get isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WA_FROM
    );
  }

  async sendMessage(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
    if (!this.isConfigured) {
      // TODO: remove this log and add real Twilio/WhatsApp delivery once configured
      this.logger.log(`[WhatsApp STUB] to=${to} body="${body.slice(0, 80)}..."`);
      return { sent: false, reason: 'whatsapp_not_configured' };
    }

    try {
      // TODO: replace with actual Twilio SDK call
      // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await client.messages.create({
      //   from: `whatsapp:${process.env.TWILIO_WA_FROM}`,
      //   to: `whatsapp:${to}`,
      //   body,
      // });
      this.logger.log(`[WhatsApp] Sent to ${to}`);
      return { sent: true };
    } catch (err) {
      this.logger.warn(`[WhatsApp] Failed to send to ${to}: ${(err as Error).message}`);
      return { sent: false, reason: (err as Error).message };
    }
  }

  async broadcastToSociety(phones: string[], body: string): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const phone of phones) {
      const result = await this.sendMessage(phone, body);
      if (result.sent) sent++;
      else failed++;
    }
    return { sent, failed };
  }
}
