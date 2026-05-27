import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

// In-memory fake of AuthRedis with the same surface used by TokenService.
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
    _peek: () => Object.fromEntries(store),
    _clear: () => store.clear(),
  };
}

function makeFakeJwt() {
  // Encode a deterministic payload + signature for unit tests. We carry the
  // full payload through verify() so tests can assert against the same object
  // the production code sees.
  return {
    sign: jest.fn((payload: any) => 'tok.' + Buffer.from(JSON.stringify(payload)).toString('base64')),
    verify: jest.fn((token: string) => {
      const b64 = token.replace(/^tok\./, '');
      const json = Buffer.from(b64, 'base64').toString();
      return JSON.parse(json);
    }),
    decode: jest.fn(),
  } as unknown as JwtService;
}

function makeConfig(overrides: Record<string, string> = {}) {
  const env: Record<string, string> = {
    JWT_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
    ...overrides,
  };
  return { get: jest.fn((k: string) => env[k]) } as unknown as ConfigService;
}

describe('TokenService.rotateRefresh', () => {
  let svc: TokenService;
  let redis: ReturnType<typeof makeFakeRedis>;
  let jwt: JwtService;
  const base = { phone: '+9100', role: 'RESIDENT', societyId: 'soc-1', managedBlocks: [] };

  beforeEach(() => {
    redis = makeFakeRedis();
    jwt = makeFakeJwt();
    svc = new TokenService(jwt, makeConfig(), redis as any);
  });

  function presentRefresh(fid: string, tid: string, sub = 'u1') {
    // Same shape token.service.sign produces — verify() round-trips it.
    return 'tok.' + Buffer.from(
      JSON.stringify({ sub, fid, tid, typ: 'refresh' }),
    ).toString('base64');
  }

  it('happy path: rotates tid, returns new pair, persists new tid in Redis', async () => {
    await redis.set('refresh:fam-1', 'tid-old');
    const pair = await svc.rotateRefresh(presentRefresh('fam-1', 'tid-old'), base);

    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    // Redis was updated to a fresh tid (NOT the old one).
    const tidAfter = await redis.get('refresh:fam-1');
    expect(tidAfter).toBeTruthy();
    expect(tidAfter).not.toBe('tid-old');
  });

  // FIX 1 — refresh-reuse race grace window.
  describe('grace window (concurrent refresh race)', () => {
    it('second call with old tid within window replays the cached pair', async () => {
      await redis.set('refresh:fam-1', 'tid-old');
      const oldToken = presentRefresh('fam-1', 'tid-old');

      const first = await svc.rotateRefresh(oldToken, base);
      // Sibling request that was in flight presents the SAME old token a moment later.
      const second = await svc.rotateRefresh(oldToken, base);

      expect(second.accessToken).toBe(first.accessToken);
      expect(second.refreshToken).toBe(first.refreshToken);
      // No new rotation, no family revoke.
      const tidAfter = await redis.get('refresh:fam-1');
      expect(tidAfter).toBeTruthy();
    });

    it('reuse OUTSIDE the grace window (no cache) revokes the family', async () => {
      await redis.set('refresh:fam-1', 'tid-old');
      const oldToken = presentRefresh('fam-1', 'tid-old');

      await svc.rotateRefresh(oldToken, base);
      // Simulate the grace cache expiring by deleting the recent-pair key.
      await redis.del('refresh:recent:tid-old');

      await expect(svc.rotateRefresh(oldToken, base)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_REUSE_DETECTED' }),
      });
      // Family is wiped.
      expect(await redis.get('refresh:fam-1')).toBeNull();
    });

    it('corrupted grace cache falls through to family revocation', async () => {
      await redis.set('refresh:fam-1', 'tid-current');
      // A stale, malformed grace entry for some old tid.
      await redis.set('refresh:recent:tid-old', '{not-json');

      await expect(
        svc.rotateRefresh(presentRefresh('fam-1', 'tid-old'), base),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_REUSE_DETECTED' }),
      });
    });
  });

  // FIX 2 — Redis-loss recovery.
  describe('Redis-loss recovery', () => {
    it('missing family key + valid JWT → reseed and proceed (not revoked)', async () => {
      // Redis has nothing for this family — simulates a Redis restart.
      const token = presentRefresh('fam-1', 'tid-only');

      const pair = await svc.rotateRefresh(token, base);

      expect(pair.accessToken).toBeTruthy();
      // After recovery, Redis is reseeded with a fresh tid.
      const tidAfter = await redis.get('refresh:fam-1');
      expect(tidAfter).toBeTruthy();
      expect(tidAfter).not.toBe('tid-only');
    });
  });

  // Admin hard-revocation must survive both the recovery path AND a Redis flush.
  // Regression: an earlier version of the reseed logic silently rebuilt the
  // family entry when revokeFamily had cleared it, bypassing admin intent.
  describe('admin revocation (tombstone)', () => {
    it('revokeFamily writes a tombstone that blocks subsequent rotateRefresh', async () => {
      await redis.set('refresh:fam-1', 'tid-1');

      await svc.revokeFamily('fam-1');

      // Tombstone present; live key cleared.
      expect(await redis.get('refresh:revoked:fam-1')).toBe('1');
      expect(await redis.get('refresh:fam-1')).toBeNull();

      await expect(
        svc.rotateRefresh(presentRefresh('fam-1', 'tid-1'), base),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_REVOKED' }),
      });
    });

    it('tombstone is checked BEFORE Redis-loss recovery (cannot be bypassed)', async () => {
      // Tombstone set but live key also missing (simulates revoke + Redis flush).
      await svc.revokeFamily('fam-2');
      await redis.del('refresh:fam-2'); // ensure key is gone (revoke already did this)

      await expect(
        svc.rotateRefresh(presentRefresh('fam-2', 'tid-1'), base),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_REVOKED' }),
      });
      // Should NOT have re-seeded the family entry.
      expect(await redis.get('refresh:fam-2')).toBeNull();
    });
  });

  // Sanity guards.
  describe('hard failures (no recovery)', () => {
    it('invalid JWT → INVALID_REFRESH (Redis untouched)', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bad signature');
      });

      await expect(svc.rotateRefresh('garbage', base)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_REFRESH' }),
      });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('non-refresh-typ token → INVALID_REFRESH', async () => {
      const accessLikeToken = 'tok.' + Buffer.from(
        JSON.stringify({ sub: 'u1', fid: 'fam-1', tid: 'tid-1', typ: 'access' }),
      ).toString('base64');
      await expect(svc.rotateRefresh(accessLikeToken, base)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
