import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const log = new Logger('CORS');

/**
 * Test whether `origin` (an HTTP Origin header value, e.g. "https://app.example.com")
 * is allowed by a single allow-list `pattern`. Patterns are either:
 *
 *   - Exact origin                — "https://society-admin-dev.marzitech.in"
 *   - Scheme + wildcard suffix    — "https://*.marzitech.in"
 *   - Bare wildcard suffix        — "*.marzitech.in" (implicitly https — we
 *                                   never wildcard-allow http origins because
 *                                   the cookie + JWT story assumes TLS)
 *
 * Wildcard `*` matches exactly ONE DNS label: it accepts
 * "https://app.marzitech.in" but rejects "https://evil.com.marzitech.in"
 * and "https://x.y.marzitech.in".
 *
 * Exported for unit testing.
 */
export function originMatchesPattern(origin: string, pattern: string): boolean {
  if (origin === pattern) return true;
  if (!pattern.includes('*')) return false;

  // Parse pattern → (scheme, hostPattern). Bare patterns default to https.
  let scheme: string;
  let hostPattern: string;
  const patternSep = pattern.indexOf('://');
  if (patternSep === -1) {
    scheme = 'https';
    hostPattern = pattern;
  } else {
    scheme = pattern.slice(0, patternSep);
    hostPattern = pattern.slice(patternSep + 3);
  }

  // Only the "*.<suffix>" shape is supported. A bare "*" is rejected at
  // module load (buildCorsOptions); patterns like "x.*.com" are not supported.
  if (!hostPattern.startsWith('*.')) return false;
  const suffix = hostPattern.slice(2);
  if (suffix.length === 0 || suffix.includes('*')) return false;

  // Parse the origin we're testing.
  const originSep = origin.indexOf('://');
  if (originSep === -1) return false;
  const originScheme = origin.slice(0, originSep);
  const rest = origin.slice(originSep + 3);
  // RFC-6454: an origin should not include a path. Defensive: reject if it does.
  if (rest.includes('/')) return false;
  const originHost = rest.split(':')[0]; // strip port

  if (originScheme !== scheme) return false;
  if (!originHost.endsWith(`.${suffix}`)) return false;

  // Subdomain part must be a single non-empty DNS label (no dots).
  const subdomain = originHost.slice(0, -(suffix.length + 1));
  if (subdomain.length === 0) return false;
  if (subdomain.includes('.')) return false;
  return true;
}

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

  // In production, reject wildcard suffixes too broad to be safe (e.g. "*.com",
  // "*.in" — a single-label TLD). A safe wildcard suffix must itself contain a
  // dot, pinning it to a specific domain ("*.marzitech.in" is fine,
  // "*.in" is not).
  if (isProd) {
    for (const p of list) {
      const hostPart = p.includes('://') ? p.slice(p.indexOf('://') + 3) : p;
      if (hostPart.startsWith('*.') && !hostPart.slice(2).includes('.')) {
        throw new Error(
          `CORS pattern too broad in production: "${p}" — a wildcard must pin to a specific domain (e.g. "*.example.com").`,
        );
      }
    }
  }

  if (list.length === 0) {
    log.warn('No CORS_ORIGINS configured — allowing all origins (dev mode).');
    return { origin: true, credentials: true };
  }

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (list.some((p) => originMatchesPattern(origin, p))) {
        return cb(null, true);
      }
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
      // SUPER_ADMIN one-shot reauth token for tenant switching (see C1).
      // Without this, browser preflights from admin-web drop the header and
      // the tenant-switch gate falls back to REAUTH_REQUIRED.
      'X-ReAuth-Token',
      'If-Match',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  };
}
