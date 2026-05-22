import { Controller, Get } from '@nestjs/common';
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

    const checks: HealthIndicatorFunction[] = [
      dbCheck,
      () => this.redis.isHealthy('redis'),
    ];

    return this.health.check(checks);
  }
}
