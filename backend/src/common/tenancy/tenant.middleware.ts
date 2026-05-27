import { Injectable, NestMiddleware, BadRequestException, Logger, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { tenantStorage, TenantContext } from './tenant.context';
import { AuthRedis } from '../../modules/auth/redis.client';

/**
 * TenantMiddleware
 *
 * Extracts tenant context (societyId, userId, role) from the bearer JWT
 * and stores it into AsyncLocalStorage so the Prisma tenant extension
 * can scope every query.
 *
 * Corner case MT4: Super-admins may switch tenant via `X-Society-Id`
 * header — this requires a fresh one-shot re-auth token in
 * `X-ReAuth-Token` (issued by POST /auth/reauth). The legacy boolean
 * `X-ReAuth-Confirmed: 1` header is no longer trusted: it was trivial
 * for the client to stamp on every request, defeating the gate.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    @Optional() private readonly jwt?: JwtService,
    @Optional() private readonly redis?: AuthRedis,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const ctx: TenantContext = {
      societyId: null,
      userId: null,
      role: null,
      superAdminBypass: false,
      reAuthConfirmed: false,
      requestId: (req.headers['x-request-id'] as string) || undefined,
    };

    const auth = req.header('authorization');
    if (auth?.startsWith('Bearer ') && this.jwt) {
      try {
        const token = auth.slice(7);
        const payload: any = this.jwt.decode(token);
        if (payload && typeof payload === 'object') {
          ctx.userId = payload.sub ?? null;
          ctx.role = payload.role ?? null;
          ctx.societyId = payload.societyId ?? null;
        }
      } catch {
        // ignore — auth guard will reject
      }
    }

    // Super-admin tenant override — requires a verified one-shot re-auth
    // token. Consumed on first read so it cannot be replayed for a second
    // switch in the same session.
    //
    // Burn-order safety: we only consume the reauth jti AFTER the bearer
    // token has been signature-verified here. If the bearer is invalid
    // (expired / forged / wrong secret), the request would fail at the
    // JwtAuthGuard anyway — burning the reauth token in that case wastes
    // the user's TOTP/OTP entry. Re-verifying the bearer here is cheap and
    // defends against that footgun.
    const switchHeader = req.header('x-society-id');
    if (switchHeader && ctx.role === 'SUPER_ADMIN' && switchHeader !== ctx.societyId) {
      const reauthHeader = req.header('x-reauth-token');
      if (!reauthHeader) {
        throw new BadRequestException({
          code: 'REAUTH_REQUIRED',
          message:
            'Super-admin tenant switch requires a fresh X-ReAuth-Token (POST /auth/reauth)',
        });
      }
      // Cheap defense: signature-verify the bearer before burning the reauth.
      const bearerOk = this.verifyBearer(req.header('authorization'));
      if (!bearerOk) {
        // Let the JwtAuthGuard surface the real error — but DO NOT burn the
        // reauth token because the request will fail downstream anyway.
        throw new BadRequestException({
          code: 'REAUTH_REQUIRES_VALID_BEARER',
          message:
            'A tenant switch needs both a valid access token and a fresh re-auth token. Please sign in again.',
        });
      }
      const ok = await this.consumeReauthToken(reauthHeader, ctx.userId);
      if (!ok) {
        throw new BadRequestException({
          code: 'REAUTH_INVALID',
          message: 'Re-auth token is invalid, expired, or already used',
        });
      }
      ctx.reAuthConfirmed = true;
      ctx.societyId = switchHeader;
      ctx.superAdminBypass = true;
    }

    tenantStorage.run(ctx, () => next());
  }

  /**
   * Signature-verify the bearer access token. Returns true iff it verifies
   * cleanly. We only use this in the reauth gate above — JwtAuthGuard does
   * the same verification later for the actual route, so this is purely a
   * pre-flight check to avoid burning the reauth jti when the bearer is bad.
   */
  private verifyBearer(authHeader: string | undefined): boolean {
    if (!authHeader?.startsWith('Bearer ') || !this.jwt || !this.config) return false;
    try {
      const token = authHeader.slice(7);
      const payload: any = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      return !!payload && typeof payload === 'object';
    } catch {
      return false;
    }
  }

  /**
   * Verify + consume a re-auth token. Returns true iff the token verifies,
   * has the expected claims, and the jti is still present in Redis (one-shot).
   * The Redis entry is deleted on successful read so replays fail closed.
   */
  private async consumeReauthToken(token: string, expectedUserId: string | null): Promise<boolean> {
    if (!this.jwt || !this.redis || !this.config) return false;
    let payload: any;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch (e: any) {
      this.logger.warn(`reauth verify failed: ${e?.message ?? e}`);
      return false;
    }
    if (
      !payload ||
      payload.typ !== 'reauth' ||
      payload.purpose !== 'tenant-switch' ||
      !payload.jti ||
      !payload.sub
    ) {
      return false;
    }
    if (expectedUserId && payload.sub !== expectedUserId) {
      this.logger.warn(`reauth subject mismatch: ${payload.sub} vs ${expectedUserId}`);
      return false;
    }
    const stored = await this.redis.get(`reauth:${payload.jti}`);
    if (!stored) return false;
    await this.redis.del(`reauth:${payload.jti}`);
    return true;
  }
}
