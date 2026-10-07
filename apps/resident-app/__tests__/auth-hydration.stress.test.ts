/**
 * Stress tests for launch-time session hydration.
 *
 * Simulates hundreds of cold starts against a Keystore whose latency and
 * failures vary from read to read — the conditions behind "stuck on the
 * splash" and "signed-in residents shown the sign-in screen" on Samsung
 * phones. Each run checks the two launch guarantees:
 *
 *   1. hydrate() ALWAYS settles, within HYDRATE_BUDGET_MS, and never throws.
 *   2. A stored session is restored whenever the Keystore answers inside the
 *      budget — slowness alone never signs anyone out.
 */

jest.mock('../src/lib/api', () => ({
  setApiToken: jest.fn(),
  setApiTokens: jest.fn(),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('../src/lib/push', () => ({ unregisterDeviceToken: jest.fn() }));

import * as SecureStore from 'expo-secure-store';
import { useAuthStore, HYDRATE_BUDGET_MS } from '../src/store/auth.store';

const getItem = SecureStore.getItemAsync as jest.Mock;

const USER = { id: 'u1', phone: '+91', role: 'RESIDENT', status: 'ACTIVE', name: 'Asha Rao' };
const SESSION: Record<string, string> = {
  auth_token: 'at',
  refresh_token: 'rt',
  society_id: 'soc',
  auth_user: JSON.stringify(USER),
};

/** Small deterministic PRNG so a failing seed can be replayed exactly. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type ReadBehaviour = { latencyMs: number; outcome: 'value' | 'throw' | 'hang' };

function coldStart() {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    societyId: null,
    isHydrated: false,
  });
}

function keystoreWith(behaviours: Record<string, ReadBehaviour>) {
  getItem.mockImplementation((key: string) => {
    const b = behaviours[key];
    return new Promise((resolve, reject) => {
      if (b.outcome === 'hang') return; // never settles
      setTimeout(() => {
        if (b.outcome === 'throw') reject(new Error(`keystore failed reading ${key}`));
        else resolve(SESSION[key]);
      }, b.latencyMs);
    });
  });
}

describe('session hydration — stress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getItem.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('300 randomised cold starts: always settles in budget, restores whenever it can', async () => {
    const random = rng(20261007);

    for (let run = 0; run < 300; run += 1) {
      coldStart();
      const behaviours: Record<string, ReadBehaviour> = {};
      for (const key of Object.keys(SESSION)) {
        const roll = random();
        behaviours[key] = {
          // Mostly fast, a long tail up to twice the budget.
          latencyMs: Math.floor(random() ** 3 * HYDRATE_BUDGET_MS * 2),
          outcome: roll < 0.04 ? 'hang' : roll < 0.08 ? 'throw' : 'value',
        };
      }
      keystoreWith(behaviours);

      const started = Date.now();
      let settled = false;
      const done = useAuthStore
        .getState()
        .hydrate()
        .then(() => {
          settled = true;
        });

      await jest.advanceTimersByTimeAsync(HYDRATE_BUDGET_MS);
      await done;

      const all = Object.values(behaviours);
      const restorable =
        all.every((b) => b.outcome !== 'hang') &&
        // refresh_token is optional; a failed read of it only drops refresh.
        ['auth_token', 'society_id', 'auth_user'].every((k) => behaviours[k].outcome === 'value') &&
        Math.max(...all.map((b) => b.latencyMs)) < HYDRATE_BUDGET_MS;

      const state = useAuthStore.getState();
      const context = `run ${run}: ${JSON.stringify(behaviours)}`;
      expect({ context, settled }).toEqual({ context, settled: true });
      expect({ context, hydrated: state.isHydrated }).toEqual({ context, hydrated: true });
      expect(Date.now() - started).toBeLessThanOrEqual(HYDRATE_BUDGET_MS);
      if (restorable) {
        expect({ context, token: state.token }).toEqual({ context, token: 'at' });
        expect(state.user).toEqual(USER);
      } else {
        // Anything partial or late is a clean sign-out, never a half session.
        const consistent =
          (state.token === null && state.user === null) ||
          (state.token === 'at' && state.user !== null && state.societyId === 'soc');
        expect({ context, consistent }).toEqual({ context, consistent: true });
      }

      // Late Keystore answers after the budget must not change anything.
      const snapshot = { ...useAuthStore.getState() };
      await jest.advanceTimersByTimeAsync(HYDRATE_BUDGET_MS * 2);
      expect(useAuthStore.getState().token).toBe(snapshot.token);
      expect(useAuthStore.getState().user).toEqual(snapshot.user);
    }
  });

  it('font loads queued AHEAD of the reads (the old ordering) no longer sign anyone out', async () => {
    // Every expo-module call shares one serial native queue. Model it: nine
    // font loads at 600ms each sit ahead of the four Keystore reads.
    let queueFreeAt = 0;
    const enqueue = <T>(costMs: number, value: T) =>
      new Promise<T>((resolve) => {
        const now = Date.now();
        queueFreeAt = Math.max(queueFreeAt, now) + costMs;
        setTimeout(() => resolve(value), queueFreeAt - now);
      });

    coldStart();
    const t0 = Date.now();
    queueFreeAt = t0;
    for (let i = 0; i < 9; i += 1) void enqueue(600, 'font'); // 5.4s of fonts
    getItem.mockImplementation((key: string) => enqueue(300, SESSION[key]));

    const done = useAuthStore.getState().hydrate();
    await jest.advanceTimersByTimeAsync(HYDRATE_BUDGET_MS);
    await done;

    // 5.4s + 4 × 0.3s = 6.6s: well past the old 2.5s per-read cap (which
    // reported "no session"), inside today's budget.
    expect(useAuthStore.getState().token).toBe('at');
  });

  it('50 overlapping hydrate() calls during one launch read each key exactly once', async () => {
    coldStart();
    keystoreWith(
      Object.fromEntries(
        Object.keys(SESSION).map((k) => [k, { latencyMs: 1500, outcome: 'value' as const }]),
      ),
    );

    const calls: Promise<void>[] = [];
    for (let i = 0; i < 50; i += 1) {
      calls.push(useAuthStore.getState().hydrate());
      await jest.advanceTimersByTimeAsync(20); // callers keep arriving mid-read
    }
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.all(calls);

    expect(getItem).toHaveBeenCalledTimes(4);
    expect(useAuthStore.getState().token).toBe('at');
  });

  it('leaves no timers behind after 100 fast launches (no leak per launch)', async () => {
    keystoreWith(
      Object.fromEntries(
        Object.keys(SESSION).map((k) => [k, { latencyMs: 5, outcome: 'value' as const }]),
      ),
    );
    for (let i = 0; i < 100; i += 1) {
      coldStart();
      const done = useAuthStore.getState().hydrate();
      await jest.advanceTimersByTimeAsync(5);
      await done;
    }
    expect(jest.getTimerCount()).toBe(0);
  });
});
