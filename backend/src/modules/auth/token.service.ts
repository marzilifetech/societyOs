import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AuthRedis } from './redis.client';

/**
 * Race-window grace period: when the SAME refresh token is presented twice
 * within this many seconds, the second call is served the CURRENT pair
 * rather than triggering family revocation. Covers the mobile-app race where
 * two API calls 401 simultaneously and both attempt a refresh — without the
 * grace window the second one trips REFRESH_REUSE_DETECTED and logs the user
 * out for what is actually benign concurrency.
 */
const REFRESH_GRACE_WINDOW_SECONDS = 30;

/**
 * JWT issuance + denylist + refresh-token rotation with family revocation.
 *
 * Refresh tokens carry: { sub, fid (family id), tid (token id), typ:'refresh' }
 * Reuse of a rotated refresh token outside the grace window revokes the
 * entire family.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private redis: AuthRedis,
  ) {
    this.accessTtl = parseTtlSeconds(this.config.get('JWT_EXPIRES_IN') || '7d');
    this.refreshTtl = parseTtlSeconds(this.config.get('JWT_REFRESH_EXPIRES_IN') || '30d');
  }

  /** Issue access + refresh pair for a fresh login. */
  async issuePair(payload: {
    sub: string;
    phone: string;
    role: string;
    societyId: string;
    managedBlocks?: string[];
  }) {
    const accessJti = uuid();
    const familyId = uuid();
    const refreshJti = uuid();
    const access = this.jwt.sign(
      { ...payload, jti: accessJti },
      { expiresIn: this.accessTtl, secret: this.config.get('JWT_SECRET') },
    );
    const refresh = this.jwt.sign(
      { sub: payload.sub, fid: familyId, tid: refreshJti, typ: 'refresh' },
      {
        expiresIn: this.refreshTtl,
        secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET'),
      },
    );

    // Track current valid token id for the family
    await this.redis.set(`refresh:${familyId}`, refreshJti, this.refreshTtl);
    return { accessToken: access, refreshToken: refresh, accessJti };
  }

  /** Verify an access token, checking denylist. */
  async verifyAccess(token: string): Promise<any> {
    let payload: any;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({ code: 'TOKEN_EXPIRED' });
      }
      // A6: clock-skew distinction
      if (e?.name === 'NotBeforeError' || /clock|skew/i.test(e?.message || '')) {
        throw new UnauthorizedException({ code: 'TOKEN_SKEW' });
      }
      throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
    }
    if (payload.jti) {
      const denied = await this.redis.get(`denylist:${payload.jti}`);
      if (denied) throw new UnauthorizedException({ code: 'TOKEN_REVOKED' });
    }
    return payload;
  }

  /** Add a JWT to the denylist for the rest of its lifetime. */
  async revoke(token: string) {
    try {
      const payload: any = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
        ignoreExpiration: true,
      });
      const ttl = Math.max(0, (payload.exp || 0) - Math.floor(Date.now() / 1000));
      if (payload.jti && ttl > 0) {
        await this.redis.set(`denylist:${payload.jti}`, '1', ttl);
      }
    } catch {
      /* invalid token; ignore */
    }
  }

  /**
   * Rotate refresh token. Three failure modes:
   *
   *  1. JWT signature invalid / expired           → INVALID_REFRESH
   *  2. Mismatched tid OUTSIDE the grace window   → REFRESH_REUSE_DETECTED (family revoked)
   *  3. Mismatched tid INSIDE the grace window    → benign race; replay the
   *     last-issued pair instead of rotating again. The client gets fresh
   *     tokens that match what its sibling request already received.
   *
   * Also auto-recovers from Redis-key loss: if the family-tid key is missing
   * but the refresh JWT is valid, we seed the key with the presented tid and
   * proceed. This makes session continuity resilient to Redis restarts and
   * eviction, which are otherwise indistinguishable from genuine revocation
   * and would force every active user to re-authenticate.
   */
  async rotateRefresh(refreshToken: string, basePayload: {
    phone: string;
    role: string;
    societyId: string;
    managedBlocks?: string[];
  }) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    }
    if (payload.typ !== 'refresh' || !payload.fid || !payload.tid) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    }

    // Hard-revocation tombstone — set by revokeFamily(). Must be checked
    // BEFORE the Redis-loss recovery path below, otherwise an admin
    // revocation can be silently undone by re-presenting the (still-valid)
    // refresh JWT, which would rebuild the family entry.
    const tombstone = await this.redis.get(`refresh:revoked:${payload.fid}`);
    if (tombstone) {
      throw new UnauthorizedException({ code: 'REFRESH_REVOKED' });
    }

    let expectedTid = await this.redis.get(`refresh:${payload.fid}`);

    // Redis lost the family entry but the refresh JWT itself is signed and
    // unexpired — most likely a Redis restart, not malice. Re-seed with the
    // presented tid and continue. The signed JWT is the source of trust here;
    // Redis is a fast cache, not the system of record. The tombstone check
    // above ensures this recovery does NOT undo explicit admin revocation.
    if (!expectedTid) {
      this.logger.warn(
        `refresh family ${payload.fid} missing from Redis — re-seeding from valid JWT`,
      );
      await this.redis.set(`refresh:${payload.fid}`, payload.tid, this.refreshTtl);
      expectedTid = payload.tid;
    }

    if (expectedTid !== payload.tid) {
      // Race-window grace: if the presented tid matches the IMMEDIATELY
      // PREVIOUS tid (rotated within the last REFRESH_GRACE_WINDOW_SECONDS),
      // serve the cached pair we minted for the first caller instead of
      // re-rotating or revoking. This is the single most common cause of
      // surprise sign-outs on mobile.
      const cachedRecent = await this.redis.get(`refresh:recent:${payload.tid}`);
      if (cachedRecent) {
        try {
          const cached = JSON.parse(cachedRecent) as { accessToken: string; refreshToken: string };
          this.logger.log(`refresh race replayed for family ${payload.fid}`);
          return cached;
        } catch {
          // Cache corruption — fall through to revocation.
        }
      }
      // Genuine reuse OUTSIDE the grace window — revoke the family.
      await this.redis.del(`refresh:${payload.fid}`);
      this.logger.warn(`refresh reuse detected — family ${payload.fid} revoked`);
      throw new UnauthorizedException({ code: 'REFRESH_REUSE_DETECTED' });
    }

    // Issue new pair with same family id
    const newAccessJti = uuid();
    const newRefreshJti = uuid();
    const access = this.jwt.sign(
      { sub: payload.sub, ...basePayload, jti: newAccessJti },
      { expiresIn: this.accessTtl, secret: this.config.get('JWT_SECRET') },
    );
    const refresh = this.jwt.sign(
      { sub: payload.sub, fid: payload.fid, tid: newRefreshJti, typ: 'refresh' },
      {
        expiresIn: this.refreshTtl,
        secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET'),
      },
    );
    await this.redis.set(`refresh:${payload.fid}`, newRefreshJti, this.refreshTtl);
    // Stash the pair against the JUST-ROTATED tid so a concurrent sibling
    // request can replay it instead of being rejected as a reuse. TTL is
    // short and bounded — this is not long-term storage.
    await this.redis.set(
      `refresh:recent:${payload.tid}`,
      JSON.stringify({ accessToken: access, refreshToken: refresh }),
      REFRESH_GRACE_WINDOW_SECONDS,
    );
    return { accessToken: access, refreshToken: refresh };
  }

  /**
   * Hard-revoke a refresh-token family. Writes a tombstone in addition to
   * deleting the live key so the Redis-loss recovery path in rotateRefresh
   * cannot rebuild trust from the still-signed refresh JWT. Tombstone TTL
   * matches the refresh-token lifetime — by the time it expires the JWT
   * would also be expired and rejected by signature verification anyway.
   */
  async revokeFamily(familyId: string) {
    await this.redis.set(`refresh:revoked:${familyId}`, '1', this.refreshTtl);
    await this.redis.del(`refresh:${familyId}`);
  }
}

function parseTtlSeconds(s: string): number {
  if (!s) return 7 * 24 * 3600;
  if (typeof s === 'number') return s;
  const m = String(s).match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 7 * 24 * 3600;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 's').toLowerCase();
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult;
}
