import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN_ADMIN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    release: process.env.SENTRY_RELEASE ?? `admin@${process.env.npm_package_version ?? '0.0.0'}`,
    initialScope: { tags: { app: 'admin' } },
  });
}
