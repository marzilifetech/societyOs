import { Injectable, NestMiddleware, BadRequestException, Logger, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { tenantStorage, TenantContext } from './tenant.context';
import { AuthRedis } from '../../modules/auth/redis.client';

/**
 * If the bearer JWT was issued within this many seconds, we treat it as
 * fresh proof-of-auth (Marzi OTP just happened) and allow super-admin
 * tenant switches without a separate one-shot re-auth token. After this
 * window the user must POST /auth/reauth to mint an X-ReAuth-Token.
 *
 * Default = 24h: in marzi-mode every refresh re-validates the session
 * against Marzi server-side (refreshTokenViaMarzi), so "this bearer is
 * still valid + the user still exists in Marzi" gives us the same
 * assurance a fresh OTP would. Forcing a second OTP every 5 minutes for
 * legitimate SUPER_ADMIN flows was friction without security gain — see
 * docs/AUTH-SECURITY-TRADEOFF.md for the deliberate tradeoff.
 *
 * To tighten the window (e.g. for high-risk staging), set
 * REAUTH_FRESH_WINDOW_SECONDS=300 to require reauth after 5 min.
 */
const DEFAULT_FRESH_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * TenantMiddleware
 *
 * Extracts tenant context (societyId, userId, role) from the bearer JWT
 * and stores it into AsyncLocalStorage so the Prisma tenant extension
 * can scope every query.
 *
 * Corner case MT4: Super-admins may switch tenant via `X-Society-Id`.
 * Accepted proofs of recent strong auth, in order of preference:
 *   1. Bearer JWT `iat` within FRESH_WINDOW_SECONDS — implicit, no extra header.
 *   2. `X-ReAuth-Token` header — one-shot signed token from POST /auth/reauth.
 * The legacy boolean `X-ReAuth-Confirmed: 1` is no longer trusted: it was
 * trivial for any client to stamp on every request, defeating the gate.
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

    // Super-admin tenant override. Two acceptable proofs:
    //   (a) Bearer JWT issued within the fresh-login window → trust as recent
    //       Marzi auth, no extra header required.
    //   (b) Explicit one-shot X-ReAuth-Token → for older sessions.
    // Burn order: when (b) is in use, the bearer is signature-verified BEFORE
    // the reauth jti is consumed so a bad bearer doesn't waste the user's OTP.
    const switchHeader = req.header('x-society-id');
    if (switchHeader && ctx.role === 'SUPER_ADMIN' && switchHeader !== ctx.societyId) {
      const verified = this.verifyBearerWithPayload(req.header('authorization'));
      if (!verified) {
        throw new BadRequestException({
          code: 'REAUTH_REQUIRES_VALID_BEARER',
          message:
            'A tenant switch needs a valid access token. Please sign in again.',
        });
      }

      // (a) Fresh-login grace — JWT issued within FRESH_WINDOW_SECONDS.
      const freshWindow = Number(
        this.config?.get('REAUTH_FRESH_WINDOW_SECONDS') ?? DEFAULT_FRESH_WINDOW_SECONDS,
      );
      const iat = typeof verified.iat === 'number' ? verified.iat : 0;
      const ageSeconds = Math.floor(Date.now() / 1000) - iat;
      const isFresh = iat > 0 && ageSeconds <= freshWindow;

      if (isFresh) {
        ctx.reAuthConfirmed = true;
        ctx.societyId = switchHeader;
        ctx.superAdminBypass = true;
      } else {
        // (b) Fall back to explicit one-shot reauth token for aged sessions.
        const reauthHeader = req.header('x-reauth-token');
        if (!reauthHeader) {
          throw new BadRequestException({
            code: 'REAUTH_REQUIRED',
            message:
              `Access token is older than ${freshWindow}s; tenant switch requires a fresh X-ReAuth-Token (POST /auth/reauth) or a fresh sign-in.`,
            ageSeconds,
            freshWindowSeconds: freshWindow,
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
    }

    tenantStorage.run(ctx, () => next());
  }

  /**
   * Signature-verify the bearer access token and return its payload.
   * Returns null on any verification failure. Used by the reauth gate to
   * (a) ensure we don't burn a reauth token when the bearer is bad, and
   * (b) read `iat` for the fresh-login grace window. JwtAuthGuard does the
   * same verification later for the actual route, so this is a pre-flight.
   */
  private verifyBearerWithPayload(authHeader: string | undefined): Record<string, any> | null {
    if (!authHeader?.startsWith('Bearer ') || !this.jwt || !this.config) return null;
    try {
      const token = authHeader.slice(7);
      const payload: any = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
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
