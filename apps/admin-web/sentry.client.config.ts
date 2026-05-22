import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN ?? process.env.SENTRY_DSN_ADMIN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    release: process.env.SENTRY_RELEASE ?? `admin@${process.env.npm_package_version ?? '0.0.0'}`,
    initialScope: { tags: { app: 'admin' } },
  });
}
