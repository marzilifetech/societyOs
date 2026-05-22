import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { setTenantAuditWriter } from '../tenancy/tenant.extension';

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  module?: string | null;
  routePath?: string | null;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  before?: unknown;
  after?: unknown;
  societyId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {
    // Wire the tenant extension so cross-tenant attempts log here too.
    setTenantAuditWriter({
      recordSecurityEvent: (e) => {
        this.write({
          entityType: e.model,
          entityId: 'n/a',
          action: `SECURITY:${e.code}`,
          module: 'tenancy',
          actorId: e.actorId,
          societyId: e.contextSocietyId,
          before: { contextSocietyId: e.contextSocietyId },
          after: { attemptedSocietyId: e.attemptedSocietyId, operation: e.operation },
        }).catch((err) => this.logger.error(`audit security event failed: ${err.message}`));
      },
    });
  }

  async write(entry: AuditEntry): Promise<void> {
    try {
      // Use the underlying client to bypass tenant scoping (AuditLog is whitelisted anyway).
      await (this.prisma as any).auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          module: entry.module ?? null,
          routePath: entry.routePath ?? null,
          method: entry.method ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          before: (entry.before as any) ?? null,
          after: (entry.after as any) ?? null,
          societyId: entry.societyId ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`audit write failed: ${err?.message ?? err}`);
    }
  }
}
