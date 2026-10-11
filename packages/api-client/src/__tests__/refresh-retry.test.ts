import { ApiClient } from '../client';

// Hand-rolled fetch fake — sequence-driven so each test can script
// per-call responses (mix 5xx → 5xx → 200) without pulling in a mock-fetch lib.
function sequentialFetch(responses: Array<() => Response | Promise<Response> | Error>) {
  let i = 0;
  return jest.fn(async () => {
    const next = responses[i++] ?? responses[responses.length - 1];
    const result = next();
    if (result instanceof Error) throw result;
    return result;
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ApiClient.tryRefresh — transient-failure retry', () => {
  let setTokens: jest.Mock;
  let getRefreshToken: jest.Mock;
  let onUnauthorized: jest.Mock;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    setTokens = jest.fn().mockResolvedValue(undefined);
    getRefreshToken = jest.fn().mockReturnValue('refresh-token-1');
    onUnauthorized = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  function makeClient(fetchImpl: typeof fetch, currentAccess = 'expired-access') {
    global.fetch = fetchImpl;
    return new ApiClient({
      baseUrl: 'https://api.test',
      getToken: () => currentAccess,
      getRefreshToken,
      setTokens,
      onUnauthorized,
    });
  }

  it('retries refresh on transient 5xx and succeeds on later attempt', async () => {
    const fetchImpl = sequentialFetch([
      () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }), // original request
      () => jsonResponse(503, { error: { code: 'UPSTREAM' } }),       // refresh #1
      () => jsonResponse(503, { error: { code: 'UPSTREAM' } }),       // refresh #2
      () => jsonResponse(200, { data: { accessToken: 'new-at', refreshToken: 'new-rt' } }), // refresh #3
      () => jsonResponse(200, { data: { ok: true } }),                // retried original
    ]) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    const promise = client.get<{ ok: boolean }>('/me');
    // Drain the backoff timers (400 + 1200ms).
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(setTokens).toHaveBeenCalledWith({ accessToken: 'new-at', refreshToken: 'new-rt' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does NOT wipe tokens when refresh fails at the network layer', async () => {
    const fetchImpl = sequentialFetch([
      () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }), // original
      () => new TypeError('Failed to fetch'),                         // refresh #1 (network)
      () => new TypeError('Failed to fetch'),                         // refresh #2
      () => new TypeError('Failed to fetch'),                         // refresh #3
    ]) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    const promise = client.get<never>('/me').catch((e: Error & { status?: number }) => e);
    await jest.runAllTimersAsync();
    const err = await promise;

    // Tokens preserved and the user is NOT signed out — being offline while
    // the access token happens to be expired says nothing about the session.
    expect(setTokens).not.toHaveBeenCalledWith(null);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Could not reach the server. Please check your connection.');
    expect(err.status).toBeUndefined();
  });

  it('does NOT sign out when the refresh endpoint answers 5xx on every attempt', async () => {
    const fetchImpl = sequentialFetch([
      () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }), // original
      () => jsonResponse(503, {}),                                    // refresh #1
      () => jsonResponse(502, {}),                                    // refresh #2
      () => jsonResponse(500, {}),                                    // refresh #3
    ]) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    const promise = client.get<never>('/me').catch((e: Error & { status?: number }) => e);
    await jest.runAllTimersAsync();
    const err = await promise;

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(setTokens).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(err.message).toBe('Could not reach the server. Please check your connection.');
  });

  it('does NOT sign out when persisting a successful refresh throws', async () => {
    // e.g. the device keystore refusing the write. The server-side session is
    // fine, so this must surface as a retryable error, never as a sign-out.
    setTokens.mockRejectedValueOnce(new Error('keystore unavailable'));
    const fetchImpl = sequentialFetch([
      () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }), // original
      () => jsonResponse(200, { data: { accessToken: 'new-at', refreshToken: 'new-rt' } }),
    ]) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    const err = await client.get<never>('/me').catch((e: Error & { status?: number }) => e);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(err.message).toBe('Could not reach the server. Please check your connection.');
  });

  it('aborts a stalled refresh instead of blocking every request behind it', async () => {
    // A refresh that never answers (half-dead mobile connection) until aborted.
    const stalled = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    let refreshCalls = 0;
    const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return refreshCalls <= 3
          ? stalled(url, init)
          : Promise.resolve(
              jsonResponse(200, { data: { accessToken: 'new-at', refreshToken: 'new-rt' } }),
            );
      }
      return Promise.resolve(
        init?.headers && (init.headers as Record<string, string>).Authorization === 'Bearer new-at'
          ? jsonResponse(200, { data: { ok: true } })
          : jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }),
      );
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    const first = client.get<never>('/me').catch((e: Error) => e);
    await jest.runAllTimersAsync();
    const err = await first;

    // Every attempt was cut off: a connection error, never a sign-out.
    expect(refreshCalls).toBe(3);
    expect(setTokens).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect((err as Error).message).toBe('Could not reach the server. Please check your connection.');

    // The stuck refresh no longer holds the slot: the next 401 refreshes again.
    const second = client.get<never>('/me').catch((e: Error) => e);
    await jest.runAllTimersAsync();
    await second;
    expect(refreshCalls).toBe(4);
    expect(setTokens).toHaveBeenCalledWith({ accessToken: 'new-at', refreshToken: 'new-rt' });
  });

  it('does NOT retry on 4xx — terminal server decision wipes tokens', async () => {
    const fetchImpl = sequentialFetch([
      () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } }), // original
      () => jsonResponse(401, { error: { code: 'REFRESH_REUSE_DETECTED' } }), // definitive
    ]) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);

    await expect(client.get('/me')).rejects.toBeTruthy();

    // Server said no — clear tokens.
    expect(setTokens).toHaveBeenCalledWith(null);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
