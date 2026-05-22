import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    super();
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(
        this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        {
          lazyConnect: true,
          connectTimeout: 1500,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        },
      );
      this.client.on('error', (e) => {
        // Avoid crashing on transient Redis errors — N2 fallback is "log and skip".
        this.logger.warn(`Redis health probe error: ${e.message}`);
      });
    }
    return this.client;
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect().catch(() => undefined);
      }
      const pong = await Promise.race([
        client.ping(),
        new Promise<string>((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 1500),
        ),
      ]);
      const latencyMs = Date.now() - start;
      const ok = pong === 'PONG';
      const result: HealthIndicatorResult = {
        [key]: { status: ok ? 'up' : 'down', latencyMs },
      };
      if (!ok) throw new HealthCheckError('Redis ping failed', result);
      return result;
    } catch (e: any) {
      const result: HealthIndicatorResult = {
        [key]: { status: 'down', error: e?.message ?? 'unknown' },
      };
      throw new HealthCheckError(
        `Redis check failed: ${e?.message ?? 'unknown'}`,
        result,
      );
    }
  }
}
