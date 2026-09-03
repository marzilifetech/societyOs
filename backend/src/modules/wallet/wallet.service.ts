import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { createHmac } from 'crypto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private razorpay: any = null;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {
    this.initRazorpay();
  }

  private notifyWalletCredited(userId: string, amount: number, txnId: string): void {
    void this.push
      .send(
        userId,
        {
          title: 'Wallet credited',
          body: `₹${amount} added to your wallet.`,
          category: 'payments_dues',
          collapseKey: `wallet-txn:${txnId}`,
        },
        { type: 'WALLET_CREDITED', entityId: txnId, transactionId: String(txnId), amount: String(amount) },
      )
      .catch((e) => this.logger.warn(`wallet credited push failed txn=${txnId}: ${(e as Error).message}`));
  }

  private notifyWalletDebited(userId: string, amount: number, txnId: string): void {
    void this.push
      .send(
        userId,
        {
          title: 'Wallet debited',
          body: `₹${amount} debited from your wallet.`,
          category: 'payments_dues',
          collapseKey: `wallet-txn:${txnId}`,
        },
        { type: 'WALLET_DEBITED', entityId: txnId, transactionId: String(txnId), amount: String(amount) },
      )
      .catch((e) => this.logger.warn(`wallet debited push failed txn=${txnId}: ${(e as Error).message}`));
  }

  private initRazorpay() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } catch (e) {
      this.logger.warn(`Razorpay init failed: ${(e as Error).message}`);
    }
  }

  private verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  }

  private async getResident(userId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { user: { id: userId } },
    });
    if (!resident) throw new NotFoundException('Resident not found');
    return resident;
  }

  async getBalance(userId: string) {
    const resident = await this.getResident(userId);
    return {
      balance: Number(resident.walletBalance),
      residentId: resident.id,
    };
  }

  async getBalanceWithRecentTransactions(userId: string) {
    const resident = await this.getResident(userId);
    const lastFive = await this.prisma.walletTransaction.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      balance: Number(resident.walletBalance),
      residentId: resident.id,
      recentTransactions: lastFive.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        status: t.status,
        description: t.description,
        reference: t.reference,
        createdAt: t.createdAt,
      })),
    };
  }

  async getTransactions(userId: string) {
    const resident = await this.getResident(userId);
    const txns = await this.prisma.walletTransaction.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return txns.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      status: t.status,
      description: t.description,
      reference: t.reference,
      createdAt: t.createdAt,
    }));
  }

  async getTransactionsPaginated(userId: string, page: number, limit: number) {
    const resident = await this.getResident(userId);
    const skip = (page - 1) * limit;
    const [total, txns] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where: { residentId: resident.id } }),
      this.prisma.walletTransaction.findMany({
        where: { residentId: resident.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: txns.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        status: t.status,
        description: t.description,
        reference: t.reference,
        createdAt: t.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createTopupOrder(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (amount > 50000) throw new BadRequestException('Max top-up is ₹50,000');

    const resident = await this.getResident(userId);
    const amountPaise = Math.round(amount * 100);
    let razorpayOrderId: string | undefined;

    if (this.razorpay) {
      try {
        const order = await this.razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: `wallet_${resident.id.slice(0, 28)}`,
          notes: { residentId: resident.id, userId },
        });
        razorpayOrderId = order.id as string;
      } catch (e) {
        this.logger.warn(`razorpay.orders.create failed: ${(e as Error).message}`);
      }
    }

    // Store pending txn as reference for verify step
    const txn = await this.prisma.walletTransaction.create({
      data: {
        residentId: resident.id,
        amount,
        type: 'CREDIT',
        status: 'PENDING',
        description: 'Wallet top-up',
        reference: razorpayOrderId,
      },
    });

    return {
      transactionId: txn.id,
      amount,
      currency: 'INR',
      razorpayOrderId,
      keyId: process.env.RAZORPAY_KEY_ID || undefined,
    };
  }

  async verifyTopupAndCredit(
    userId: string,
    dto: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    const resident = await this.getResident(userId);

    // Find the pending txn for this order
    const txn = await this.prisma.walletTransaction.findFirst({
      where: {
        residentId: resident.id,
        reference: dto.razorpayOrderId,
        status: 'PENDING',
        type: 'CREDIT',
      },
    });

    if (!txn) throw new BadRequestException('No pending top-up order found for this resident');

    // Idempotency: already completed
    if ((txn as any).status === 'COMPLETED') {
      return { success: true, transactionId: txn.id, alreadyProcessed: true };
    }

    if (this.razorpay) {
      const ok = this.verifyRazorpaySignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
      if (!ok) {
        throw new BadRequestException({ code: 'INVALID_SIGNATURE', message: 'Razorpay signature verification failed' });
      }
    }

    const amount = Number(txn.amount);

    await this.prisma.$transaction([
      this.prisma.walletTransaction.update({
        where: { id: txn.id },
        data: { status: 'COMPLETED', reference: dto.razorpayPaymentId },
      }),
      this.prisma.resident.update({
        where: { id: resident.id },
        data: { walletBalance: { increment: amount } },
      }),
    ]);

    this.notifyWalletCredited(userId, amount, txn.id);

    return { success: true, transactionId: txn.id, amount };
  }

  async topUp(userId: string, dto: { amount: number; reference?: string }) {
    if (dto.amount <= 0) throw new BadRequestException('Amount must be positive');
    if (dto.amount > 50000) throw new BadRequestException('Max top-up is ₹50,000');

    const resident = await this.getResident(userId);

    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          residentId: resident.id,
          amount: dto.amount,
          type: 'CREDIT',
          status: 'COMPLETED',
          description: 'Wallet top-up',
          reference: dto.reference,
        },
      }),
      this.prisma.resident.update({
        where: { id: resident.id },
        data: { walletBalance: { increment: dto.amount } },
      }),
    ]);

    this.notifyWalletCredited(userId, dto.amount, txn.id);

    return { success: true, transactionId: txn.id, amount: dto.amount };
  }

  async deduct(userId: string, dto: { amount: number; description: string; reference?: string }) {
    if (dto.amount <= 0) throw new BadRequestException('Amount must be positive');

    const resident = await this.getResident(userId);
    if (Number(resident.walletBalance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          residentId: resident.id,
          amount: dto.amount,
          type: 'DEBIT',
          status: 'COMPLETED',
          description: dto.description,
          reference: dto.reference,
        },
      }),
      this.prisma.resident.update({
        where: { id: resident.id },
        data: { walletBalance: { decrement: dto.amount } },
      }),
    ]);

    this.notifyWalletDebited(userId, dto.amount, txn.id);

    return { success: true, transactionId: txn.id, amount: dto.amount };
  }

  async refund(
    residentId: string,
    dto: {
      amount: number;
      description: string;
      reference: string;
      /** Caller's tenant. Required for admin-issued refunds. */
      societyId?: string;
      issuedBy?: string;
    },
  ) {
    if (!(dto.amount > 0)) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero' });
    }

    // Tenant scope. `Resident` is deliberately NOT in the Prisma tenant
    // extension's DIRECT_TENANT_SCOPED set (it has no societyId column), so
    // without this check an admin could credit a resident in another society
    // just by knowing their id.
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: residentId,
        ...(dto.societyId ? { user: { societyId: dto.societyId } } : {}),
      },
      select: { id: true, userId: true },
    });
    if (!resident) {
      throw new NotFoundException({
        code: 'RESIDENT_NOT_FOUND',
        message: 'Resident not found in this society',
      });
    }

    // Idempotency: check if reference already processed
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { reference: dto.reference, type: 'CREDIT' },
    });
    if (existing) return { success: true, transactionId: existing.id, alreadyProcessed: true };

    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          residentId,
          amount: dto.amount,
          type: 'CREDIT',
          status: 'COMPLETED',
          description: dto.issuedBy ? `${dto.description} (refund issued by admin)` : dto.description,
          reference: dto.reference,
        },
      }),
      this.prisma.resident.update({
        where: { id: residentId },
        data: { walletBalance: { increment: dto.amount } },
      }),
    ]);

    if (resident.userId) this.notifyWalletCredited(resident.userId, dto.amount, txn.id);

    return { success: true, transactionId: txn.id, amount: dto.amount, residentId };
  }

  /**
   * Type-ahead for the admin refund form. The form used to ask the operator to
   * type a raw `res_abc123` id by hand, which is unusable in practice.
   */
  async searchResidentsForRefund(societyId: string, q?: string) {
    const term = q?.trim();
    const residents = await this.prisma.resident.findMany({
      where: {
        deletedAt: null,
        user: { societyId },
        ...(term
          ? {
              OR: [
                { user: { societyId, name: { contains: term, mode: 'insensitive' as const } } },
                { user: { societyId, phone: { contains: term } } },
                { flat: { number: { contains: term, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { user: { select: { name: true, phone: true } }, flat: { select: { block: true, number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return residents.map((r) => ({
      id: r.id,
      name: r.user?.name ?? 'Resident',
      phone: r.user?.phone ?? null,
      flat: r.flat ? `${r.flat.block ? `${r.flat.block}-` : ''}${r.flat.number}` : null,
      walletBalance: Number(r.walletBalance),
    }));
  }

  /**
   * Internal: deduct wallet balance when paying a maintenance bill.
   * Called from maintenance payment flow.
   */
  async deductForMaintenance(residentId: string, amount: number, billId: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const resident = await this.prisma.resident.findUnique({ where: { id: residentId } });
    if (!resident) throw new NotFoundException('Resident not found');
    if (Number(resident.walletBalance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const reference = `maintenance_bill_${billId}`;

    // Idempotency check
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { residentId, reference, type: 'DEBIT', status: 'COMPLETED' },
    });
    if (existing) return { success: true, transactionId: existing.id, alreadyProcessed: true };

    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          residentId,
          amount,
          type: 'DEBIT',
          status: 'COMPLETED',
          description: `Maintenance bill payment`,
          reference,
        },
      }),
      this.prisma.resident.update({
        where: { id: residentId },
        data: { walletBalance: { decrement: amount } },
      }),
    ]);

    if (resident.userId) this.notifyWalletDebited(resident.userId, amount, txn.id);

    return { success: true, transactionId: txn.id, amount };
  }

  async getSocietyWalletActivity(societyId: string) {
    return this.prisma.walletTransaction.findMany({
      where: { resident: { user: { societyId } } },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
