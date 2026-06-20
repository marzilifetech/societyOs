import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { PushService } from '../../common/notification/push.service';
import { createHmac } from 'crypto';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private razorpay: any = null;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {
    this.initRazorpay();
  }

  private initRazorpay() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return;
    try {
      // Lazy require so missing dep at install time doesn't break boot.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } catch (e) {
      this.logger.warn(`Razorpay init failed: ${(e as Error).message}`);
    }
  }

  private serializeBill<T extends { total: any; status: PaymentStatus; dueDate: Date; period: string; breakdown: any; payments?: any[] }>(bill: T) {
    const isOverdue = bill.status === PaymentStatus.PENDING && bill.dueDate < new Date();
    return {
      ...bill,
      amount: Number(bill.total),
      month: bill.period,
      status: isOverdue ? 'OVERDUE' : bill.status,
      breakdown: bill.breakdown ?? {},
      payments: bill.payments?.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };
  }

  async getBills(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    const bills = await this.prisma.maintenanceBill.findMany({
      where: { residentId: resident.id },
      include: { payments: true },
      orderBy: { dueDate: 'desc' },
    });

    return bills.map((bill) => this.serializeBill(bill));
  }

  async getBill(id: string, userId?: string) {
    const bill = await this.prisma.maintenanceBill.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    if (userId) {
      const resident = await requireResidentByUserId(this.prisma, userId);
      if (bill.residentId !== resident.id) {
        throw new ForbiddenException('Bill does not belong to this resident');
      }
    }

    return this.serializeBill(bill);
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    // The client may send either our internal Payment.id or the razorpay payment id (gatewayRef).
    let payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      payment = await this.prisma.payment.findFirst({ where: { gatewayRef: paymentId } });
    }
    if (!payment || payment.residentId !== resident.id) {
      throw new NotFoundException('Payment not found');
    }
    return {
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      paidAt: payment.paidAt,
    };
  }

  async getReceipt(paymentId: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    let payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      payment = await this.prisma.payment.findFirst({ where: { gatewayRef: paymentId } });
    }
    if (!payment || payment.residentId !== resident.id) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Receipt available only for successful payments');
    }
    return {
      id: payment.id,
      url: payment.receiptUrl ?? null,
      paidAt: payment.paidAt,
      amount: Number(payment.amount),
    };
  }

  async createPaymentOrder(billId: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const bill = await this.getBill(billId, userId);

    // P2 corner case: idempotency key bill:{billId}:{userId}:{day}
    // Reuse existing PENDING payment for the same bill+resident on the same day
    // before creating a new Razorpay order.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const existing = await this.prisma.payment.findFirst({
      where: {
        billId,
        residentId: resident.id,
        status: PaymentStatus.PENDING,
        createdAt: { gte: dayStart },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        paymentId: existing.id,
        amount: Number(existing.amount),
        currency: 'INR',
        razorpayOrderId: existing.gatewayRef || undefined,
        idempotent: true,
      };
    }

    const amountPaise = Math.round(Number(bill.total) * 100);
    let razorpayOrderId: string | undefined;

    if (this.razorpay) {
      try {
        const order = await this.razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: `bill_${billId.slice(0, 30)}`,
          notes: { billId, residentId: resident.id, userId },
        });
        razorpayOrderId = order.id as string;
      } catch (e) {
        this.logger.warn(`razorpay.orders.create failed: ${(e as Error).message}`);
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        billId,
        residentId: resident.id,
        amount: bill.total,
        status: PaymentStatus.PENDING,
        gatewayRef: razorpayOrderId, // store order id; replaced with payment id on verify
      },
    });

    return {
      paymentId: payment.id,
      amount: Number(bill.total),
      currency: 'INR',
      razorpayOrderId,
      keyId: process.env.RAZORPAY_KEY_ID || undefined,
    };
  }

  /**
   * Razorpay HMAC-SHA256 signature verification.
   * signature == hmac(key_secret, order_id + '|' + payment_id)
   */
  private verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    // Constant-time-ish compare
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  }

  async verifyPayment(
    paymentId: string,
    userId: string,
    gatewayRef: string,
    receiptUrl?: string,
    razorpayOrderId?: string,
    razorpaySignature?: string,
  ) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment || payment.residentId !== resident.id) {
      throw new NotFoundException('Payment not found');
    }

    // First-write-wins (P4 corner): if webhook already marked SUCCESS, return as-is.
    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    // If Razorpay creds present and signature provided, verify.
    if (razorpaySignature) {
      const orderId = razorpayOrderId || payment.gatewayRef || '';
      const ok = this.verifyRazorpaySignature(orderId, gatewayRef, razorpaySignature);
      if (!ok) {
        this.logger.warn(`razorpay signature mismatch payment=${paymentId}`);
        throw new BadRequestException({
          code: 'INVALID_SIGNATURE',
          message: 'Razorpay signature verification failed',
        });
      }
    } else if (this.razorpay) {
      // Razorpay configured but client didn't pass signature — webhook authoritative.
      this.logger.debug(`verifyPayment without signature; awaiting webhook for ${paymentId}`);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCESS,
        gatewayRef,
        receiptUrl,
        paidAt: new Date(),
      },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Payment received',
          body: `Payment of ₹${Number(updated.amount)} received. Thank you.`,
          category: 'payments_dues',
          collapseKey: `bill:${updated.billId}`,
        },
        {
          type: 'PAYMENT_RECEIVED',
          entityId: updated.id,
          paymentId: String(updated.id),
          billId: String(updated.billId),
          amount: String(Number(updated.amount)),
        },
      )
      .catch((e) => this.logger.warn(`payment received push failed payment=${updated.id}: ${(e as Error).message}`));

    return updated;
  }

  async handleWebhookPayment(paymentId: string) {
    // First-write-wins on Payment.status; idempotent.
    const existing = await this.prisma.payment.findFirst({ where: { gatewayRef: paymentId } });
    if (existing && existing.status === PaymentStatus.SUCCESS) {
      return existing;
    }
    return this.prisma.payment.update({
      where: { gatewayRef: paymentId },
      data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
    });
  }

  /**
   * Razorpay webhook handler: verifies signature against raw body using webhook secret.
   * Called from controller with raw payload.
   */
  async exportBillsCsv(opts: { userId: string; isAdmin: boolean; year?: number; residentId?: string }): Promise<string> {
    const where: any = {};

    if (!opts.isAdmin) {
      const resident = await requireResidentByUserId(this.prisma, opts.userId);
      where.residentId = resident.id;
    } else if (opts.residentId) {
      where.residentId = opts.residentId;
    }

    if (opts.year) {
      const start = new Date(`${opts.year}-01-01T00:00:00.000Z`);
      const end = new Date(`${opts.year + 1}-01-01T00:00:00.000Z`);
      where.dueDate = { gte: start, lt: end };
    }

    const bills = await this.prisma.maintenanceBill.findMany({
      where,
      include: { payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 1 } },
      orderBy: { dueDate: 'desc' },
    });

    const header = 'Bill#,Period,Amount,DueDate,Status,PaidAt\n';
    const body = bills
      .map((bill) => {
        const paidAt = bill.payments[0]?.paidAt?.toISOString() ?? '';
        const isOverdue = bill.status === 'PENDING' && bill.dueDate < new Date();
        const status = isOverdue ? 'OVERDUE' : bill.status;
        return [
          bill.id,
          bill.period,
          Number(bill.total).toFixed(2),
          bill.dueDate.toISOString().split('T')[0],
          status,
          paidAt,
        ].join(',');
      })
      .join('\n');

    return header + body;
  }

  async setAutoPay(userId: string, enabled: boolean) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const flat = await this.prisma.flat.findUnique({ where: { id: resident.flatId } });
    const society = flat
      ? await this.prisma.society.findUnique({ where: { id: flat.societyId } })
      : null;
    if (society) {
      const cfg = (typeof society.config === 'object' && society.config && !Array.isArray(society.config))
        ? (society.config as Record<string, unknown>)
        : {};
      const autoPayPrefs = (cfg.autoPayPrefs as Record<string, boolean> | undefined) ?? {};
      autoPayPrefs[resident.id] = enabled;
      await this.prisma.society.update({
        where: { id: society.id },
        data: { config: { ...cfg, autoPayPrefs } },
      });
    }
    return { autoPayEnabled: enabled };
  }

  async handleRazorpayWebhook(rawBody: Buffer, signatureHeader: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException({ code: 'WEBHOOK_NOT_CONFIGURED' });
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected !== signatureHeader) {
      this.logger.warn('razorpay webhook signature mismatch');
      throw new BadRequestException({ code: 'INVALID_SIGNATURE' });
    }

    const event = JSON.parse(rawBody.toString('utf-8'));
    const eventType = event.event as string;
    const payload = event.payload?.payment?.entity || {};

    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      const orderId = payload.order_id as string | undefined;
      const paymentId = payload.id as string | undefined;
      if (orderId) {
        const payment = await this.prisma.payment.findFirst({ where: { gatewayRef: orderId }, include: { resident: true } });
        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.SUCCESS,
              gatewayRef: paymentId || orderId,
              paidAt: new Date(),
            },
          });
          const userId = payment.resident?.userId;
          if (userId) {
            void this.push
              .send(
                userId,
                {
                  title: 'Payment received',
                  body: `Payment of ₹${Number(payment.amount)} received. Thank you.`,
                  category: 'payments_dues',
                  collapseKey: `bill:${payment.billId}`,
                },
                {
                  type: 'PAYMENT_RECEIVED',
                  entityId: payment.id,
                  paymentId: String(payment.id),
                  billId: String(payment.billId),
                  amount: String(Number(payment.amount)),
                },
              )
              .catch((e) => this.logger.warn(`payment received push failed payment=${payment.id}: ${(e as Error).message}`));
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const orderId = payload.order_id as string | undefined;
      if (orderId) {
        const payment = await this.prisma.payment.findFirst({ where: { gatewayRef: orderId }, include: { resident: true } });
        if (payment && payment.status === PaymentStatus.PENDING) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
          const userId = payment.resident?.userId;
          if (userId) {
            void this.push
              .send(
                userId,
                {
                  title: 'Payment failed',
                  body: `Your payment of ₹${Number(payment.amount)} could not be completed. Please try again.`,
                  category: 'payments_dues',
                  collapseKey: `bill:${payment.billId}`,
                },
                {
                  type: 'PAYMENT_FAILED',
                  entityId: payment.id,
                  paymentId: String(payment.id),
                  billId: String(payment.billId),
                  amount: String(Number(payment.amount)),
                },
              )
              .catch((e) => this.logger.warn(`payment failed push failed payment=${payment.id}: ${(e as Error).message}`));
          }
        }
      }
    }

    return { ok: true, event: eventType };
  }
}
