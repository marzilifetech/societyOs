/**
 * Push is the product's primary delivery mechanism, and it can be silently
 * absent: `initFirebase()` warns once at boot and then every send() returns
 * `{ok:false}` indistinguishably from an opted-out user. Readiness is where
 * that becomes visible.
 */
import { HealthController } from './health.controller';

function makeController(push: any) {
  const health = {
    check: jest.fn(async (checks: any[]) => {
      const results = await Promise.all(checks.map((c) => c()));
      return Object.assign({}, ...results);
    }),
  } as any;
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) } as any;
  const redis = { isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }) } as any;
  return new HealthController(health, {} as any, redis, prisma, push);
}

describe('readiness push reporting', () => {
  it('reports push up when Firebase is configured', async () => {
    const res: any = await makeController({
      isConfigured: () => true,
      hasDeferQueue: () => true,
    }).readiness();
    expect(res.push).toMatchObject({ status: 'up', configured: true, quietHoursQueue: 'up' });
    expect(res.push.message).toBeUndefined();
  });

  it('reports DEGRADED, not down, when the service account is missing', async () => {
    // Degraded rather than down on purpose: the API is perfectly usable
    // without push (everything still lands in the in-app inbox), so this must
    // not pull an instance out of the load balancer. It exists to be seen.
    const res: any = await makeController({
      isConfigured: () => false,
      hasDeferQueue: () => false,
    }).readiness();
    expect(res.push.status).toBe('degraded');
    expect(res.push.configured).toBe(false);
    expect(res.push.message).toMatch(/FIREBASE_SA_BASE64/);
  });

  it('flags the quiet-hours queue separately from Firebase itself', async () => {
    // Without Redis a quiet-hours push is DROPPED rather than held, which is a
    // different failure from "no push at all".
    const res: any = await makeController({
      isConfigured: () => true,
      hasDeferQueue: () => false,
    }).readiness();
    expect(res.push.status).toBe('up');
    expect(res.push.quietHoursQueue).toBe('unavailable');
  });

  it('survives PushService being absent entirely', async () => {
    // PushModule is registered through `tryAdd`, which silently skips a module
    // whose import throws. A hard dependency here would take down the liveness
    // probe — the one endpoint that must never fail.
    const res: any = await makeController(undefined).readiness();
    expect(res.push.status).toBe('degraded');
    expect(res.push.message).toMatch(/not loaded/);
  });

  it('still reports the database and redis alongside push', async () => {
    const res: any = await makeController({
      isConfigured: () => true,
      hasDeferQueue: () => true,
    }).readiness();
    expect(res.db).toEqual({ status: 'up' });
    expect(res.redis).toEqual({ status: 'up' });
  });

  it('liveness stays minimal and never touches push', async () => {
    // Liveness must not depend on anything external, or a push outage
    // restarts healthy containers.
    expect(makeController(undefined).liveness()).toEqual({ status: 'ok' });
  });
});
