/* Sentry bootstrap. Called from main.ts before NestFactory.create. */
import type { ConfigService } from '@nestjs/config';

const PII_KEYS = new Set([
  'phone',
  'email',
  'aadhaar',
  'password',
  'totpSecret',
  'otp',
  'token',
  'refreshToken',
  'fcmToken',
  'authorization',
  'cookie',
]);

function scrub(value: any, depth = 0): any {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function initSentry(config: ConfigService): boolean {
  const dsn = config.get<string>('SENTRY_DSN');
  if (!dsn) return false;
  try {

    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: config.get<string>('NODE_ENV', 'development'),
      tracesSampleRate: Number(config.get('SENTRY_TRACES_SAMPLE_RATE', 0.1)),
      beforeSend(event: any) {
        try {
          if (event.request) {
            if (event.request.headers) {
              for (const h of Object.keys(event.request.headers)) {
                if (PII_KEYS.has(h.toLowerCase())) {
                  event.request.headers[h] = '[REDACTED]';
                }
              }
            }
            if (event.request.data) event.request.data = scrub(event.request.data);
            if (event.request.cookies) event.request.cookies = '[REDACTED]';
          }
          if (event.user) {
            event.user = scrub(event.user);
          }
          if (event.extra) event.extra = scrub(event.extra);
          if (event.contexts) event.contexts = scrub(event.contexts);
        } catch {
          /* swallow */
        }
        return event;
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function flushSentry(timeoutMs = 2000): Promise<boolean> {
  try {

    const Sentry = require('@sentry/node');
    return Sentry.close ? Sentry.close(timeoutMs) : Promise.resolve(true);
  } catch {
    return Promise.resolve(true);
  }
}
