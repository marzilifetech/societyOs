import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuthRedis } from '../auth/redis.client';

const TTL_SECONDS = 24 * 3600;

/**
 * Translation with Redis cache. If `GOOGLE_TRANSLATE_API_KEY` is set, uses Google
 * Cloud Translation v2; otherwise returns the source text unchanged.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(
    private redis: AuthRedis,
    private config: ConfigService,
  ) {}

  async translate(text: string, target: string): Promise<{ translated: string; cached: boolean }> {
    const key = `translate:${createHash('sha256').update(`${target}|${text}`).digest('hex')}`;
    const cached = await this.redis.get(key);
    if (cached !== null) return { translated: cached, cached: true };

    const apiKey = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');
    let translated = text;
    if (apiKey && target && text.trim()) {
      try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, target, format: 'text' }),
        });
        if (!res.ok) {
          this.logger.warn(`Google Translate HTTP ${res.status}`);
        } else {
          const body = (await res.json()) as {
            data?: { translations?: { translatedText?: string }[] };
          };
          const out = body?.data?.translations?.[0]?.translatedText;
          if (out) translated = out;
        }
      } catch (e) {
        this.logger.warn(`Google Translate failed: ${(e as Error).message}`);
      }
    }

    await this.redis.set(key, translated, TTL_SECONDS);
    return { translated, cached: false };
  }
}
