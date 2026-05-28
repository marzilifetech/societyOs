import {
  ThrottlerAsyncOptions,
  ThrottlerModuleOptions,
  ThrottlerGuard,
} from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExecutionContext, Injectable } from '@nestjs/common';

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
      const userId = req.user?.sub ?? req.user?.id ?? '';
      return `${ip}|${userId}`;
    }

    return ip;
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
