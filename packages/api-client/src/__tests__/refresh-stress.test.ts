import { ApiClient, type TokenPair } from '../client';

/**
 * Stress tests for the refresh-token path under concurrency.
 *
 * A cold start fires every Home query at once (profile, requests, notices,
 * pinned notice, unread count, pending visitors, the tabs guard …). When the
 * stored access token has expired, all of them 401 together, so the refresh
 * path is exercised by bursts, never by a single call. These tests drive the
 * client against a small stateful fake server that rotates tokens exactly like
 * the backend: each refresh token is single-use, and presenting a used one is
 * reuse — the server kills the session.
 */

type FakeServerOptions = {
  /** What the refresh endpoint does. */
  refresh?: 'ok' | 'reject' | 'offline' | 'down';
  /** Artificial latency for every response, in ms. */
  latencyMs?: number;
};

function createFakeServer({ refresh = 'ok', latencyMs = 0 }: FakeServerOptions = {}) {
  let generation = 1;
  let validAccess = `at-${generation}`;
  let validRefresh = `rt-${generation}`;
  const usedRefreshTokens = new Set<string>();
  const stats = { requests: 0, refreshCalls: 0, refreshReuse: 0, maxConcurrentRefresh: 0 };
  let refreshInFlight = 0;

  const delay = () =>
    latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = jest.fn(async (url: string, init: RequestInit = {}) => {
    stats.requests += 1;

    if (url.endsWith('/auth/refresh')) {
      stats.refreshCalls += 1;
      refreshInFlight += 1;
      stats.maxConcurrentRefresh = Math.max(stats.maxConcurrentRefresh, refreshInFlight);
      try {
        await delay();
        if (refresh === 'offline') throw new TypeError('Network request failed');
        if (refresh === 'down') return json(503, {});
        if (refresh === 'reject') return json(401, { error: { code: 'INVALID_REFRESH' } });

        const presented = JSON.parse(String(init.body)).refreshToken as string;
        if (usedRefreshTokens.has(presented)) {
          stats.refreshReuse += 1;
          return json(401, { error: { code: 'REFRESH_REUSE_DETECTED' } });
        }
        if (presented !== validRefresh) return json(401, { error: { code: 'INVALID_REFRESH' } });

        usedRefreshTokens.add(presented);
        generation += 1;
        validAccess = `at-${generation}`;
        validRefresh = `rt-${generation}`;
        return json(200, { data: { accessToken: validAccess, refreshToken: validRefresh } });
      } finally {
        refreshInFlight -= 1;
      }
    }

    await delay();
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    if (auth !== `Bearer ${validAccess}`) {
      return json(401, { error: { code: 'TOKEN_EXPIRED' } });
    }
    return json(200, { data: { path: url } });
  });

  return {
    fetchImpl,
    stats,
    /** Expire the current access token without touching the refresh token. */
    expireAccess() {
      validAccess = `at-${generation}-rotated-out`;
    },
    get currentRefresh() {
      return validRefresh;
    },
  };
}

function createClient(server: ReturnType<typeof createFakeServer>) {
  let access: string | null = 'at-stale';
  let refresh: string | null = 'rt-1';
  const setTokens = jest.fn(async (pair: TokenPair | null) => {
    access = pair?.accessToken ?? null;
    refresh = pair?.refreshToken ?? null;
  });
  const onUnauthorized = jest.fn();
  (global as any).fetch = server.fetchImpl;
  const client = new ApiClient({
    baseUrl: 'https://api.test',
    getToken: () => access,
    getRefreshToken: () => refresh,
    setTokens,
    onUnauthorized,
  });
  return {
    client,
    setTokens,
    onUnauthorized,
    get access() {
      return access;
    },
    get refresh() {
      return refresh;
    },
  };
}

describe('ApiClient refresh — stress', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('100 concurrent 401s share ONE refresh and all succeed', async () => {
    const server = createFakeServer({ latencyMs: 5 });
    const ctx = createClient(server);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => ctx.client.get<{ path: string }>(`/q/${i}`)),
    );

    expect(results).toHaveLength(100);
    results.forEach((r, i) => expect(r.path).toBe(`https://api.test/q/${i}`));
    expect(server.stats.refreshCalls).toBe(1);
    expect(server.stats.maxConcurrentRefresh).toBe(1);
    expect(server.stats.refreshReuse).toBe(0);
    expect(ctx.onUnauthorized).not.toHaveBeenCalled();
    expect(ctx.access).toBe('at-2');
    expect(ctx.refresh).toBe('rt-2');
  });

  it('never presents a used refresh token across 25 expiry waves', async () => {
    const server = createFakeServer({ latencyMs: 2 });
    const ctx = createClient(server);

    for (let wave = 0; wave < 25; wave += 1) {
      server.expireAccess();
      // Uneven burst sizes so waves overlap the refresh at different points.
      const size = 5 + ((wave * 7) % 20);
      await Promise.all(Array.from({ length: size }, (_, i) => ctx.client.get(`/w${wave}/${i}`)));
    }

    // One refresh per wave, never two at once, never a reused token.
    expect(server.stats.refreshCalls).toBe(25);
    expect(server.stats.maxConcurrentRefresh).toBe(1);
    expect(server.stats.refreshReuse).toBe(0);
    expect(ctx.onUnauthorized).not.toHaveBeenCalled();
    expect(ctx.refresh).toBe(server.currentRefresh);
  });

  it('a 401 that lands after the refresh finished refreshes with the ROTATED token', async () => {
    const server = createFakeServer();
    const ctx = createClient(server);

    // First burst rotates rt-1 -> rt-2.
    await Promise.all([ctx.client.get('/a'), ctx.client.get('/b')]);
    // A straggler that still carries an expired token arrives afterwards.
    server.expireAccess();
    await ctx.client.get('/late');

    expect(server.stats.refreshCalls).toBe(2);
    expect(server.stats.refreshReuse).toBe(0);
    expect(ctx.onUnauthorized).not.toHaveBeenCalled();
  });

  it('server rejects the refresh: tokens wiped ONCE, every caller gets a session error', async () => {
    const server = createFakeServer({ refresh: 'reject' });
    const ctx = createClient(server);

    const settled = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => ctx.client.get(`/q/${i}`)),
    );

    expect(settled.every((s) => s.status === 'rejected')).toBe(true);
    settled.forEach((s) =>
      expect((s as PromiseRejectedResult).reason.message).toBe(
        'Your session ended. Please sign in again.',
      ),
    );
    expect(server.stats.refreshCalls).toBe(1);
    expect(ctx.setTokens).toHaveBeenCalledTimes(1);
    expect(ctx.setTokens).toHaveBeenCalledWith(null);
    // The client reports every failed request; de-duplicating the resulting
    // sign-out is the app's job (see resident-app session handling).
    expect(ctx.onUnauthorized).toHaveBeenCalledTimes(50);
  });

  it.each(['offline', 'down'] as const)(
    'refresh %s: nobody is signed out, tokens are kept, callers get a connection error',
    async (mode) => {
      jest.useFakeTimers();
      const server = createFakeServer({ refresh: mode });
      const ctx = createClient(server);

      const pending = Promise.allSettled(
        Array.from({ length: 50 }, (_, i) => ctx.client.get(`/q/${i}`)),
      );
      await jest.runAllTimersAsync();
      const settled = await pending;

      expect(settled.every((s) => s.status === 'rejected')).toBe(true);
      settled.forEach((s) =>
        expect((s as PromiseRejectedResult).reason.message).toBe(
          'Could not reach the server. Please check your connection.',
        ),
      );
      // One refresh sequence of three attempts, shared by all 50 callers.
      expect(server.stats.refreshCalls).toBe(3);
      expect(ctx.setTokens).not.toHaveBeenCalled();
      expect(ctx.onUnauthorized).not.toHaveBeenCalled();
      expect(ctx.refresh).toBe('rt-1');
    },
  );

  it('recovers on the next burst once the network is back', async () => {
    jest.useFakeTimers();
    const offline = createFakeServer({ refresh: 'offline' });
    const ctx = createClient(offline);

    const first = ctx.client.get<never>('/home').catch((e: Error) => e);
    await jest.runAllTimersAsync();
    expect((await first).message).toMatch(/Could not reach the server/);

    // Back online: same client, same (untouched) refresh token.
    jest.useRealTimers();
    const online = createFakeServer();
    (global as any).fetch = online.fetchImpl;

    await expect(ctx.client.get<{ path: string }>('/home')).resolves.toEqual({
      path: 'https://api.test/home',
    });
    expect(ctx.onUnauthorized).not.toHaveBeenCalled();
  });
});
