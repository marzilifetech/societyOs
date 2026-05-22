import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Lightweight Redis facade with a graceful in-memory fallback so unit tests
 * and dev environments without Redis still work. P1 may swap this for a shared
 * client without changing call sites.
 */
@Injectable()
export class AuthRedis implements OnModuleDestroy {
  private readonly logger = new Logger(AuthRedis.name);
  private client: any = null;
  private mem = new Map<string, { v: string; exp: number | null }>();

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set; AuthRedis using in-memory fallback');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
      this.client.on('error', (e: Error) => this.logger.warn(`redis err: ${e.message}`));
    } catch (e) {
      this.logger.warn(`ioredis unavailable: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit?.();
    } catch {
      /* noop */
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
      return;
    }
    this.mem.set(key, { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async get(key: string): Promise<string | null> {
    if (this.client) return this.client.get(key);
    const v = this.mem.get(key);
    if (!v) return null;
    if (v.exp && Date.now() > v.exp) {
      this.mem.delete(key);
      return null;
    }
    return v.v;
  }

  async del(key: string): Promise<void> {
    if (this.client) await this.client.del(key);
    else this.mem.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.client) {
      const n = await this.client.incr(key);
      if (n === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
      return n;
    }
    const cur = await this.get(key);
    const n = (cur ? parseInt(cur, 10) : 0) + 1;
    await this.set(key, String(n), ttlSeconds);
    return n;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.client) {
      await this.client.expire(key, ttlSeconds);
      return;
    }
    const v = this.mem.get(key);
    if (v) v.exp = Date.now() + ttlSeconds * 1000;
  }

  async ttl(key: string): Promise<number> {
    if (this.client) return this.client.ttl(key);
    const v = this.mem.get(key);
    if (!v || !v.exp) return -1;
    return Math.max(0, Math.floor((v.exp - Date.now()) / 1000));
  }
}
