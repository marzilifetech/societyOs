import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AuthRedis } from './redis.client';

/**
 * JWT issuance + denylist + refresh-token rotation with family revocation.
 *
 * Refresh tokens carry: { sub, fid (family id), tid (token id), typ:'refresh' }
 * Reuse of a rotated refresh token revokes the entire family.
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
   * Rotate refresh token. On reuse of an already-rotated token the entire
   * family is revoked (A7).
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

    const expectedTid = await this.redis.get(`refresh:${payload.fid}`);
    if (!expectedTid) {
      throw new UnauthorizedException({ code: 'REFRESH_REVOKED' });
    }
    if (expectedTid !== payload.tid) {
      // Reuse detected — revoke entire family
      await this.redis.del(`refresh:${payload.fid}`);
      this.logger.warn(`refresh reuse detected — family ${payload.fid} revoked`);
      // Audit hook (P3): emit security event
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
    return { accessToken: access, refreshToken: refresh };
  }

  async revokeFamily(familyId: string) {
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
