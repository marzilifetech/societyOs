import {
  ThrottlerAsyncOptions,
  ThrottlerModuleOptions,
  ThrottlerGuard,
  seconds,
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
    const limitAuth = config.get<number>('THROTTLE_LIMIT_AUTH', 10);
    const limitSos = config.get<number>('THROTTLE_LIMIT_SOS', 5);

    return {
      throttlers: [
        // Default bucket — applied to everything that doesn't override.
        { name: 'default', ttl: ttlMs, limit: limitDefault },
        // Stricter buckets that handlers can opt into via @Throttle.
        { name: 'auth', ttl: ttlMs, limit: limitAuth },
        { name: 'sos', ttl: seconds(60), limit: limitSos },
      ],
    };
  },
};
