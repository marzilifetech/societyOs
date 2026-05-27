import { BadRequestException } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { tenantStorage } from './tenant.context';

// In-memory fakes for the three injected deps.
function makeFakeJwt(verifyImpl?: (token: string) => any) {
  return {
    verify: jest.fn((token: string) => {
      if (verifyImpl) return verifyImpl(token);
      // Default: decode base64 middle segment (no signature check) so tests
      // can shape payloads via the token string.
      const middle = token.split('.')[1];
      return JSON.parse(Buffer.from(middle, 'base64').toString());
    }),
    decode: jest.fn((token: string) => {
      const middle = token.split('.')[1];
      try {
        return JSON.parse(Buffer.from(middle, 'base64').toString());
      } catch {
        return null;
      }
    }),
  } as any;
}

function makeFakeRedis() {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    del: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    _seed: (k: string, v: string) => store.set(k, v),
  };
}

function makeFakeConfig(env: Record<string, string | number> = {}) {
  return {
    get: jest.fn((k: string) => env[k] ?? (k === 'JWT_SECRET' ? 'test-secret' : undefined)),
  };
}

function makeReq(headers: Record<string, string> = {}) {
  return {
    header: (n: string) => headers[n.toLowerCase()] ?? headers[n] ?? undefined,
    headers: {},
  } as any;
}

function mintBearer(payload: Record<string, any>): string {
  // Synthetic 3-segment token. middleware uses jwt.verify which is mocked
  // to base64-decode the middle segment.
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${body}.sig`;
}

describe('TenantMiddleware — reauth gate', () => {
  let jwt: any;
  let redis: ReturnType<typeof makeFakeRedis>;
  let config: any;
  let mw: TenantMiddleware;
  let runWithCtxSpy: jest.SpyInstance;

  beforeEach(() => {
    jwt = makeFakeJwt();
    redis = makeFakeRedis();
    config = makeFakeConfig({ REAUTH_FRESH_WINDOW_SECONDS: 300 });
    mw = new TenantMiddleware(jwt, redis as any, config);
    runWithCtxSpy = jest.spyOn(tenantStorage, 'run').mockImplementation(((_ctx: any, fn: any) => fn()) as any);
  });

  afterEach(() => {
    runWithCtxSpy.mockRestore();
  });

  // Fresh-login window: 25s after issuance → no reauth header required.
  it('allows tenant switch with fresh JWT and NO reauth token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = mintBearer({ sub: 'sa-1', role: 'SUPER_ADMIN', societyId: 'soc-home', iat: now - 25 });
    const req = makeReq({
      authorization: `Bearer ${token}`,
      'x-society-id': 'soc-target',
    });
    const next = jest.fn();

    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    // Should NOT consult Redis for a reauth token in the fresh path.
    expect(redis.get).not.toHaveBeenCalled();
  });

  // Aged session: > 5 min since iat → must produce reauth token.
  it('rejects tenant switch with aged JWT and missing reauth token (REAUTH_REQUIRED)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = mintBearer({ sub: 'sa-1', role: 'SUPER_ADMIN', societyId: 'soc-home', iat: now - 1200 });
    const req = makeReq({
      authorization: `Bearer ${token}`,
      'x-society-id': 'soc-target',
    });
    await expect(mw.use(req, {} as any, jest.fn())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REAUTH_REQUIRED' }),
    });
  });

  // Aged JWT + valid reauth token → consumed once, then proceeds.
  it('accepts aged JWT when a valid one-shot reauth token is provided', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = mintBearer({ sub: 'sa-1', role: 'SUPER_ADMIN', societyId: 'soc-home', iat: now - 1200 });
    const reauthToken = mintBearer({
      sub: 'sa-1',
      typ: 'reauth',
      purpose: 'tenant-switch',
      jti: 'reauth-jti-1',
    });
    redis._seed('reauth:reauth-jti-1', '1');

    const req = makeReq({
      authorization: `Bearer ${token}`,
      'x-society-id': 'soc-target',
      'x-reauth-token': reauthToken,
    });
    const next = jest.fn();
    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    // jti consumed (deleted).
    expect(redis.del).toHaveBeenCalledWith('reauth:reauth-jti-1');
  });

  // Bearer-bad protection: don't burn the reauth token if bearer fails verify.
  it('does NOT burn the reauth token when the bearer is invalid', async () => {
    jwt.verify = jest.fn((token: string) => {
      if (token.startsWith('header.')) throw new Error('bad signature');
      const middle = token.split('.')[1];
      return JSON.parse(Buffer.from(middle, 'base64').toString());
    });
    const reauthToken = 'reauth.eyJzdWIiOiJzYS0xIn0=.sig';
    redis._seed('reauth:reauth-jti-1', '1');

    const req = makeReq({
      authorization: `Bearer ${mintBearer({ sub: 'sa-1', role: 'SUPER_ADMIN', societyId: 'soc-home', iat: 0 })}`,
      'x-society-id': 'soc-target',
      'x-reauth-token': reauthToken,
    });
    await expect(mw.use(req, {} as any, jest.fn())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REAUTH_REQUIRES_VALID_BEARER' }),
    });
    expect(redis.del).not.toHaveBeenCalled();
  });

  // Non-super-admin → switch is ignored, no reauth check fires.
  it('ignores X-Society-Id for non-SUPER_ADMIN roles', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = mintBearer({ sub: 'a-1', role: 'ADMIN', societyId: 'soc-home', iat: now });
    const req = makeReq({
      authorization: `Bearer ${token}`,
      'x-society-id': 'soc-target',
    });
    const next = jest.fn();
    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    // No reauth path even attempted.
    expect(redis.get).not.toHaveBeenCalled();
  });

  // No switch header → middleware just sets context and calls next.
  it('no-ops the override when X-Society-Id matches the JWT societyId', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = mintBearer({ sub: 'sa-1', role: 'SUPER_ADMIN', societyId: 'soc-home', iat: now });
    const req = makeReq({
      authorization: `Bearer ${token}`,
      'x-society-id': 'soc-home',
    });
    const next = jest.fn();
    await mw.use(req, {} as any, next);
    expect(next).toHaveBeenCalled();
  });
});
