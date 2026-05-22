import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ConsentAction =
  | 'ACCEPTED_TOS'
  | 'ACCEPTED_PRIVACY'
  | 'REVOKED_PRIVACY'
  | 'DATA_EXPORT_REQUESTED'
  | 'DATA_DELETE_REQUESTED';

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Default privacy-policy version. Society.config can override. */
  static DEFAULT_VERSION = '2026-04-30';

  async resolveVersion(societyId: string | null | undefined): Promise<string> {
    if (!societyId) return ConsentService.DEFAULT_VERSION;
    const s = await (this.prisma as any).society.findUnique({ where: { id: societyId } });
    const cfg = (s?.config as any) ?? {};
    return cfg.privacyPolicyVersion ?? ConsentService.DEFAULT_VERSION;
  }

  async record(opts: {
    userId: string;
    action: ConsentAction;
    societyId?: string | null;
    ipAddress?: string | null;
    details?: Record<string, unknown>;
  }) {
    const version = await this.resolveVersion(opts.societyId);
    return (this.prisma as any).consentLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        version,
        details: { ...(opts.details ?? {}), version, at: new Date().toISOString() },
        ipAddress: opts.ipAddress ?? null,
      },
    });
  }

  async revoke(userId: string, ipAddress?: string | null) {
    const last = await (this.prisma as any).consentLog.findFirst({
      where: { userId, action: 'ACCEPTED_PRIVACY', revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) throw new NotFoundException('No active consent to revoke');
    await (this.prisma as any).consentLog.update({
      where: { id: last.id },
      data: { revokedAt: new Date() },
    });
    return this.record({
      userId,
      action: 'REVOKED_PRIVACY',
      ipAddress,
    });
  }

  async hasActiveConsent(userId: string): Promise<boolean> {
    const last = await (this.prisma as any).consentLog.findFirst({
      where: { userId, action: 'ACCEPTED_PRIVACY', revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return !!last;
  }
}
