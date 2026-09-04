import { Controller, Get, Optional } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisHealthIndicator } from './redis.health';
import { PushService } from '../notification/push.service';

// In-memory shutdown flag — flipped by main.container.ts on SIGTERM for LB drain grace.
// Lambdas don't use this (no long-running server to drain).
export const shutdownState = { draining: false };

@ApiExcludeController()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly prisma: PrismaService,
    /**
     * OPTIONAL on purpose. PushModule is registered through `tryAdd` in
     * app.module.ts, which silently skips the module if its import throws — so
     * PushService is not guaranteed to exist. Making this a hard dependency
     * would mean a missing push module takes down the health controller, and
     * with it every liveness probe: the one thing that must never fail.
     */
    @Optional() private readonly push?: PushService,
  ) {}

  // Liveness — minimal, never depends on external services.
  @Get('health')
  liveness() {
    if (shutdownState.draining) {
      return { status: 'draining' };
    }
    return { status: 'ok' };
  }

  // Readiness — full dep check.
  @Get('readyz')
  @HealthCheck()
  readiness() {
    const dbCheck: HealthIndicatorFunction = async () => {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return { db: { status: 'up' } };
      } catch (e: any) {
        return { db: { status: 'down', message: e?.message } };
      }
    };

    /**
     * Push is the product's primary delivery mechanism — tasks, gate entries
     * and emergencies all reach people through it. When the Firebase service
     * account is missing or malformed, `initFirebase()` logs a warning once at
     * boot and every subsequent send returns `{ok:false}` indistinguishably
     * from an opted-out user. Nothing outside the process could tell.
     *
     * Reported as DEGRADED rather than down: the API is still fully usable
     * without push (everything lands in the in-app inbox), so this must not
     * take an instance out of the load balancer. It exists to be visible.
     */
    const pushCheck: HealthIndicatorFunction = async () => {
      const configured = this.push?.isConfigured() ?? false;
      return {
        push: {
          status: (configured ? 'up' : 'degraded') as 'up' | 'down',
          configured,
          // Without the queue, quiet-hours pushes are dropped rather than held.
          quietHoursQueue: this.push?.hasDeferQueue() ? 'up' : 'unavailable',
          ...(configured
            ? {}
            : {
                message: this.push
                  ? 'FIREBASE_SA_BASE64 / FIREBASE_SERVICE_ACCOUNT not set — no push will be delivered'
                  : 'Push module not loaded — no push will be delivered',
              }),
        },
      };
    };

    const checks: HealthIndicatorFunction[] = [
      dbCheck,
      () => this.redis.isHealthy('redis'),
      pushCheck,
    ];

    return this.health.check(checks);
  }
}
