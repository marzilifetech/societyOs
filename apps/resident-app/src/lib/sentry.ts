// Sentry init for resident-app. Imported once from app/_layout.tsx.
import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN_RESIDENT ?? process.env.SENTRY_DSN_RESIDENT;
  if (!dsn) {
    initialized = true;
    return;
  }
  // Leave `release` unset unless SENTRY_RELEASE overrides it: the SDK then
  // tags events with the native release (e.g. "com.marzi.resident@1.0.15+21",
  // dist "21"), which is exactly the release the Sentry Gradle/Xcode build
  // step uploads source maps under. A hand-made "resident@<version>" never
  // matched, so every stack trace would have stayed minified.
  const release = process.env.SENTRY_RELEASE;

  Sentry.init({
    dsn,
    ...(release ? { release } : {}),
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    enableNative: true,
    beforeSend(event) {
      event.tags = { ...(event.tags ?? {}), app: 'resident' };
      return event;
    },
  });

  const g: any = globalThis as any;
  if (typeof g.HermesInternal !== 'undefined' && g.process?.on) {
    g.process.on('unhandledRejection', (reason: unknown) => {
      Sentry.captureException(reason);
    });
  }
  initialized = true;
}

export function setSentryUser(userId: string | null) {
  try {
    if (userId) Sentry.setUser({ id: userId });
    else Sentry.setUser(null);
  } catch {
    /* ignore */
  }
}

export { Sentry };
