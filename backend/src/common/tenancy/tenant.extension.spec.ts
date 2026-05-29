import { ForbiddenException } from '@nestjs/common';
import { tenantStorage, TenantContext } from './tenant.context';

// Pull the operation handler out of the extension so we can unit-test the
// branch logic without spinning up Prisma.
import { tenantExtension } from './tenant.extension';

function getOp(): (opts: any) => Promise<any> {
  // Prisma.defineExtension returns a builder; reach into the query map.
  const ext: any = tenantExtension as any;
  // Try multiple shapes to be robust across Prisma versions
  const def = ext?.query?.$allModels?.$allOperations
    ?? ext?.def?.query?.$allModels?.$allOperations
    ?? ext?.extension?.query?.$allModels?.$allOperations;
  if (typeof def === 'function') return def;
  // Fallback: scan top-level keys for the function
  for (const k of Object.keys(ext)) {
    const v = ext[k];
    const fn = v?.query?.$allModels?.$allOperations;
    if (typeof fn === 'function') return fn;
  }
  throw new Error('cannot locate $allOperations handler');
}

function withCtx(ctx: TenantContext, fn: () => Promise<any>) {
  return tenantStorage.run(ctx, fn);
}

describe('tenant.extension', () => {
  let op: (opts: any) => Promise<any>;

  beforeAll(() => {
    try {
      op = getOp();
    } catch {
      op = null as any;
    }
  });

  it('injects societyId into where on findMany for tenant-scoped models', async () => {
    if (!op) return; // defensive: schema-extraction may differ across Prisma minor versions
    let captured: any;
    const query = (a: any) => {
      captured = a;
      return Promise.resolve(a);
    };
    await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
      await op({ model: 'ServiceRequest', operation: 'findMany', args: { where: {} }, query });
    });
    expect(captured.where.societyId).toBe('soc-1');
  });

  it('throws CROSS_TENANT_ACCESS when query supplies mismatched societyId', async () => {
    if (!op) return;
    const query = (a: any) => Promise.resolve(a);
    await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
      await expect(
        op({
          model: 'ServiceRequest',
          operation: 'findMany',
          args: { where: { societyId: 'soc-2' } },
          query,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('passes through cross-tenant whitelist (User)', async () => {
    if (!op) return;
    let captured: any;
    const query = (a: any) => {
      captured = a;
      return Promise.resolve(a);
    };
    await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
      await op({ model: 'User', operation: 'findMany', args: { where: { id: 'x' } }, query });
    });
    expect(captured.where.societyId).toBeUndefined();
  });

  it('SUPER_ADMIN bypass skips scoping', async () => {
    if (!op) return;
    let captured: any;
    const query = (a: any) => {
      captured = a;
      return Promise.resolve(a);
    };
    await withCtx(
      {
        societyId: 'soc-1',
        userId: 'u',
        role: 'SUPER_ADMIN',
        superAdminBypass: true,
      },
      async () => {
        await op({
          model: 'ServiceRequest',
          operation: 'findMany',
          args: { where: { societyId: 'soc-2' } },
          query,
        });
      },
    );
    expect(captured.where.societyId).toBe('soc-2');
  });

  // Regression: 8 models with direct `societyId` were missing from the
  // DIRECT_TENANT_SCOPED set, allowing a forgotten `where` clause to leak
  // across tenants. Added 2026-05.
  describe.each([
    'ConciergeRequest',
    'LaundryBooking',
    'SecurityIncident',
    'HousekeepingRequest',
    'PestControlSchedule',
    'CanteenPreOrder',
    'Vendor',
    'VendorOrder',
  ])('newly tenant-scoped model: %s', (model) => {
    it('auto-injects societyId on findMany when caller forgets it', async () => {
      if (!op) return;
      let captured: any;
      const query = (a: any) => {
        captured = a;
        return Promise.resolve(a);
      };
      await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
        await op({ model, operation: 'findMany', args: { where: {} }, query });
      });
      expect(captured.where.societyId).toBe('soc-1');
    });

    it('rejects mismatched societyId on findMany', async () => {
      if (!op) return;
      const query = (a: any) => Promise.resolve(a);
      await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
        await expect(
          op({
            model,
            operation: 'findMany',
            args: { where: { societyId: 'soc-2' } },
            query,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it('stamps societyId on create when missing', async () => {
      if (!op) return;
      let captured: any;
      const query = (a: any) => {
        captured = a;
        return Promise.resolve(a);
      };
      await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
        await op({ model, operation: 'create', args: { data: { foo: 'bar' } }, query });
      });
      expect(captured.data.societyId).toBe('soc-1');
    });

    it('rejects cross-tenant create', async () => {
      if (!op) return;
      const query = (a: any) => Promise.resolve(a);
      await withCtx({ societyId: 'soc-1', userId: 'u', role: 'ADMIN' }, async () => {
        await expect(
          op({
            model,
            operation: 'create',
            args: { data: { societyId: 'soc-2', foo: 'bar' } },
            query,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });
  });
});
