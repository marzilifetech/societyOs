// Sentry init for resident-app. Imported once from app/_layout.tsx.
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN_RESIDENT ?? process.env.SENTRY_DSN_RESIDENT;
  if (!dsn) {
    initialized = true;
    return;
  }
  const release =
    process.env.SENTRY_RELEASE ??
    `resident@${(Constants?.expoConfig?.version as string | undefined) ?? '0.0.0'}`;

  Sentry.init({
    dsn,
    release,
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
