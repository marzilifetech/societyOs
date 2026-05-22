import type { NextConfig } from 'next';
import path from 'path';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

// CSP: keep tight; allow self + api origin + img-data + Sentry ingest if configured.
const sentryHost = process.env.SENTRY_DSN_ADMIN
  ? new URL(process.env.SENTRY_DSN_ADMIN).origin
  : '';
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${sentryHost} ws: wss:`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Standalone output bundles the real runtime deps (next, etc.) into
  // .next/standalone. Required for Amplify SSR hosting: pnpm's symlinked
  // node_modules don't survive the deploy packaging in a monorepo.
  output: 'standalone',
  // Trace from the monorepo root so workspace + .pnpm store deps are included.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
