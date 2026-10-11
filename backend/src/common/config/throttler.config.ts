import {
  ThrottlerAsyncOptions,
  ThrottlerModuleOptions,
  ThrottlerGuard,
} from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { verify } from 'jsonwebtoken';

/**
 * The `sub` claim of the request's bearer token, for rate-limit bucketing
 * only. The signature IS checked: this guard runs before JwtAuthGuard, and an
 * unverified subject let anyone fill another user's bucket (a resident could
 * 429 a guard by sending unsigned tokens carrying the guard's id). Undefined
 * when absent, malformed, expired or not signed by us — the caller then falls
 * back to the IP.
 */
export function bearerSubject(
  req: { headers?: Record<string, unknown> },
  secret: string | undefined = process.env.JWT_SECRET,
): string | undefined {
  const header = req.headers?.authorization;
  if (!secret || typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
  try {
    const claims = verify(header.slice(7), secret) as { sub?: unknown };
    return typeof claims?.sub === 'string' && claims.sub.length > 0 && claims.sub.length <= 64
      ? claims.sub
      : undefined;
  } catch {
    return undefined;
  }
}

// Custom guard: per-route quotas + IP+phone composite key for OTP routes.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    // Behind proxy: trust proxy is enabled, so req.ip already reflects X-Forwarded-For.
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const path: string = req.path ?? req.url ?? '';

    // OTP / auth routes: composite IP+phone (so NAT users don't share quota).
    if (path.includes('/auth/') || path.includes('/otp')) {
      const phone =
        req.body?.phone ??
        req.body?.phoneNumber ??
        req.body?.mobile ??
        '';
      return `${ip}|${phone}`;
    }

    // SOS: composite IP + userId (sub) when authenticated
    if (path.includes('/sos/trigger')) {
      const userId = req.user?.sub ?? req.user?.id ?? bearerSubject(req) ?? '';
      return `${ip}|${userId}`;
    }

    // Signed-in requests are counted per USER, not per IP. Most Indian mobile
    // users sit behind carrier-grade NAT (Jio especially), and a society's
    // guards share the gate Wi-Fi, so hundreds of unrelated phones can present
    // one public IP. Keyed by IP, they shared a single 100/min budget and the
    // apps failed with 429s at random. Only a token we signed counts; anything
    // else is bucketed by IP.
    const sub = bearerSubject(req);
    return sub ? `user:${sub}` : ip;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path: string | undefined = req?.path ?? req?.url;
    if (!path) return false;
    if (
      path === '/health' ||
      path === '/readyz' ||
      path.startsWith('/api/docs')
    ) {
      return true;
    }
    return super.shouldSkip(context);
  }
}

export const throttlerOptions: ThrottlerAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService): ThrottlerModuleOptions => {
    const ttlMs = config.get<number>('THROTTLE_TTL_MS', 60_000);
    const limitDefault = config.get<number>('THROTTLE_LIMIT_DEFAULT', 100);

    // Only the `default` bucket is registered globally. Stricter limits on
    // specific routes (auth/OTP, SOS trigger) are applied via per-route
    // @Throttle({ default: { limit, ttl } }) overrides — same pattern auth
    // controller already uses. Defining named buckets here would apply them
    // to EVERY route (Nest throttler behaviour), which previously rate-
    // limited /sos/active reads down to 5/min and broke admin polling.
    // THROTTLE_LIMIT_AUTH / THROTTLE_LIMIT_SOS env vars are retained in
    // env.validation for backwards compat but no longer consumed.
    return {
      throttlers: [
        { name: 'default', ttl: ttlMs, limit: limitDefault },
      ],
    };
  },
};
