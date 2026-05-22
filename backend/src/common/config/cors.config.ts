import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const log = new Logger('CORS');

export function buildCorsOptions(rawOrigins: string, isProd: boolean): CorsOptions {
  const list = (rawOrigins ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (isProd && (list.length === 0 || list.includes('*'))) {
    throw new Error(
      'CORS_ORIGINS must be a non-empty allowlist in production (wildcard "*" rejected).',
    );
  }

  if (list.length === 0) {
    log.warn('No CORS_ORIGINS configured — allowing all origins (dev mode).');
    return { origin: true, credentials: true };
  }

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (list.includes(origin)) return cb(null, true);
      log.warn(`CORS rejected origin: ${origin}`);
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Society-Id',
      'If-Match',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  };
}
