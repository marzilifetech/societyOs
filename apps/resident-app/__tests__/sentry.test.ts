/**
 * Tests for apps/resident-app/src/lib/sentry.ts
 *
 * Uses jest.resetModules() to reset the module-level `initialized` flag between tests.
 */

export {};

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  Event: class {},
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '3.0.0' } },
}));

function remock() {
  jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    setUser: jest.fn(),
  }));
  jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { version: '3.0.0' } },
  }));
}

describe('initSentry', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
    // Reset environment vars
    delete process.env.SENTRY_DSN_RESIDENT;
    delete process.env.SENTRY_DSN_RESIDENT;
    delete process.env.SENTRY_RELEASE;
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN_RESIDENT;
    delete process.env.SENTRY_DSN_RESIDENT;
    delete process.env.SENTRY_RELEASE;
  });

  it('does not call Sentry.init when no DSN is set', () => {
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('is idempotent — only inits once even if called multiple times', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    initSentry();
    initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('calls Sentry.init with the DSN when SENTRY_DSN_RESIDENT is set', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@sentry.io/1' }),
    );
  });

  it('falls back to SENTRY_DSN_RESIDENT when EXPO_PUBLIC is absent', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://fallback@sentry.io/2';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://fallback@sentry.io/2' }),
    );
  });

  it('uses SENTRY_RELEASE env var when set', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    process.env.SENTRY_RELEASE = 'resident@custom-release';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ release: 'resident@custom-release' }),
    );
  });

  it('builds release from expoConfig.version when SENTRY_RELEASE is absent', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ release: 'resident@3.0.0' }),
    );
  });

  it('falls back to "0.0.0" in release when expoConfig.version is absent', () => {
    jest.resetModules();
    jest.mock('@sentry/react-native', () => ({ init: jest.fn(), captureException: jest.fn(), setUser: jest.fn() }));
    jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ release: 'resident@0.0.0' }),
    );
  });

  it('beforeSend adds app: resident tag to the event', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    const initCall = Sentry.init.mock.calls[0][0];
    const result = initCall.beforeSend({ tags: { existing: 'tag' } });
    expect(result.tags).toEqual({ existing: 'tag', app: 'resident' });
  });

  it('beforeSend works when event has no tags', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    const { initSentry } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    initSentry();
    const initCall = Sentry.init.mock.calls[0][0];
    const result = initCall.beforeSend({});
    expect(result.tags).toEqual({ app: 'resident' });
  });

  it('registers unhandledRejection handler when HermesInternal is defined', () => {
    jest.resetModules();
    remock();
    const onSpy = jest.fn();
    // Replace globalThis.process so g.process?.on is our spy AND env has the DSN
    const originalProcess = (globalThis as any).process;
    (globalThis as any).HermesInternal = {};
    (globalThis as any).process = { on: onSpy, env: { SENTRY_DSN_RESIDENT: 'https://key@sentry.io/1' } };
    try {
      const { initSentry } = require('../src/lib/sentry');
      initSentry();
      expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      // Invoke the handler to cover that branch
      const Sentry = require('@sentry/react-native');
      const handler = onSpy.mock.calls[0][1];
      handler(new Error('unhandled'));
      expect(Sentry.captureException).toHaveBeenCalledWith(new Error('unhandled'));
    } finally {
      delete (globalThis as any).HermesInternal;
      (globalThis as any).process = originalProcess;
    }
  });

  it('skips HermesInternal handler when HermesInternal is undefined', () => {
    process.env.SENTRY_DSN_RESIDENT = 'https://key@sentry.io/1';
    delete (globalThis as any).HermesInternal;
    const { initSentry } = require('../src/lib/sentry');
    expect(() => initSentry()).not.toThrow();
  });
});

describe('setSentryUser', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    remock();
  });

  it('calls Sentry.setUser with id when userId is provided', () => {
    const { setSentryUser } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    setSentryUser('user-123');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-123' });
  });

  it('calls Sentry.setUser(null) when userId is null', () => {
    const { setSentryUser } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    setSentryUser(null);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('swallows Sentry.setUser errors gracefully', () => {
    const { setSentryUser } = require('../src/lib/sentry');
    const Sentry = require('@sentry/react-native');
    Sentry.setUser.mockImplementation(() => { throw new Error('Sentry error'); });
    expect(() => setSentryUser('u1')).not.toThrow();
  });
});

describe('Sentry re-export', () => {
  it('re-exports Sentry namespace', () => {
    jest.resetModules();
    remock();
    const mod = require('../src/lib/sentry');
    expect(mod.Sentry).toBeDefined();
    expect(typeof mod.Sentry.captureException).toBe('function');
  });
});
