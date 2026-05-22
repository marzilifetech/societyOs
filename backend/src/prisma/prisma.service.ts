import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantExtension } from '../common/tenancy/tenant.extension';

/**
 * PrismaService
 *
 * Applies the multi-tenant Prisma client extension so every query is
 * automatically scoped to the caller's `societyId` (resolved from
 * AsyncLocalStorage). See `common/tenancy/tenant.extension.ts`.
 *
 * Use `this.client` for the extended client in feature services. Direct
 * inheritance from PrismaClient is preserved for backward-compat with
 * existing services that call `this.<model>` — those calls still resolve
 * to the un-extended client. New code should prefer `this.client`.
 *
 * NOTE: We re-route the dynamic model accessors via Proxy so that legacy
 * `this.staffMember.findUnique(...)` calls also benefit from tenant
 * scoping without refactoring every service.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Extended client with tenant scoping applied. */
  public client: ReturnType<PrismaClient['$extends']>;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
    this.client = (this as any).$extends(tenantExtension);

    // Route model accessors through the extended client so all callers
    // (this.user, this.resident, this.staffMember, etc.) get tenant scoping.
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // Pass through methods/properties Nest needs and lifecycle hooks
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === 'client' ||
          prop === '$connect' ||
          prop === '$disconnect' ||
          prop === '$transaction' ||
          prop === '$on' ||
          prop === '$use' ||
          prop === '$queryRaw' ||
          prop === '$queryRawUnsafe' ||
          prop === '$executeRaw' ||
          prop === '$executeRawUnsafe' ||
          prop === '$extends' ||
          typeof prop === 'symbol'
        ) {
          return Reflect.get(target, prop, receiver);
        }
        const ext = (target as any).client;
        if (ext && prop in ext) return ext[prop as any];
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
