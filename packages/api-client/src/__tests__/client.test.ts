import { ApiClient } from '../client';

// Helper to build a minimal mock Response
function makeOkResponse(body: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeErrResponse(status: number, body?: unknown): Response {
  return {
    ok: false,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ApiClient', () => {
  let mockFetch: jest.Mock;
  const getToken = jest.fn<string | null, []>(() => 'tok-abc');
  const onUnauthorized = jest.fn();
  let client: ApiClient;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as any).fetch = mockFetch;
    jest.clearAllMocks();
    getToken.mockReturnValue('tok-abc');
    client = new ApiClient({
      baseUrl: 'https://api.example.com/v1',
      getToken,
      onUnauthorized,
    });
  });

  // ─── HTTP methods ────────────────────────────────────────────────────────────

  describe('HTTP method routing', () => {
    it('GET sends no body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/ping');
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
    });

    it('POST sends JSON-encoded body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.post('/items', { name: 'foo' });
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'foo' }));
    });

    it('POST without body sends no body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.post('/action');
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBeUndefined();
    });

    it('PATCH sends correct method', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.patch('/items/1', { x: 1 });
      expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });

    it('PUT sends correct method', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.put('/items/1', { x: 1 });
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('DELETE sends correct method and no body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.delete('/items/1');
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
    });
  });

  // ─── URL construction ────────────────────────────────────────────────────────

  describe('URL construction', () => {
    it('concatenates baseUrl + path', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/health');
      expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.com/v1/health');
    });
  });

  // ─── Authorization header ────────────────────────────────────────────────────

  describe('Authorization header', () => {
    it('includes Bearer token when getToken returns a value', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/secure');
      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer tok-abc');
    });

    it('omits Authorization header when getToken returns null', async () => {
      getToken.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/public');
      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('always includes Content-Type: application/json', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/x');
      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // ─── 204 No Content ──────────────────────────────────────────────────────────

  describe('204 No Content', () => {
    it('returns undefined without calling .json()', async () => {
      const jsonFn = jest.fn();
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: jsonFn } as any);
      const result = await client.delete('/items/1');
      expect(result).toBeUndefined();
      expect(jsonFn).not.toHaveBeenCalled();
    });
  });

  // ─── Data envelope unwrapping ─────────────────────────────────────────────────

  describe('response envelope unwrapping', () => {
    it('returns data field when { data, meta, error } envelope is present', async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ data: { id: 42 }, meta: { requestId: 'r1' }, error: null }),
      );
      expect(await client.get('/thing')).toEqual({ id: 42 });
    });

    it('returns raw JSON when no data field is present', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ result: 'ok' }));
      expect(await client.get('/raw')).toEqual({ result: 'ok' });
    });

    it('returns null when data field is explicitly null', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ data: null }));
      expect(await client.get('/nullable')).toBeNull();
    });

    it('returns array when data is an array', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ data: [1, 2, 3], meta: {}, error: null }));
      expect(await client.get('/list')).toEqual([1, 2, 3]);
    });
  });

  // ─── 401 Unauthorized ────────────────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('calls onUnauthorized callback', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      await expect(client.get('/protected')).rejects.toThrow();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('throws with status 401 and session-ended message', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      const err: any = await client.get('/protected').catch((e) => e);
      expect(err.message).toBe('Your session ended. Please sign in again.');
      expect(err.status).toBe(401);
    });

    it('does not call onUnauthorized when not provided', async () => {
      const bare = new ApiClient({ baseUrl: 'https://x.com', getToken });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      await expect(bare.get('/')).rejects.toMatchObject({ status: 401 });
      // should not throw due to missing callback
    });
  });

  // ─── 5xx Server Errors ───────────────────────────────────────────────────────

  describe('5xx Server Errors', () => {
    it.each([500, 502, 503, 504])(
      'throws with status %d and generic message',
      async (status) => {
        mockFetch.mockResolvedValueOnce({ ok: false, status } as any);
        const err: any = await client.get('/crash').catch((e) => e);
        expect(err.message).toBe('Something went wrong. Please try again in a moment.');
        expect(err.status).toBe(status);
      },
    );
  });

  // ─── 4xx Client Errors ───────────────────────────────────────────────────────

  describe('4xx Client Errors', () => {
    it('uses error.message from body when present', async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrResponse(422, { error: { message: 'Validation failed', code: 'INVALID_INPUT' } }),
      );
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.message).toBe('Validation failed');
      expect(err.status).toBe(422);
    });

    it('sets err.code from error.code when it is a string', async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrResponse(422, { error: { message: 'Oops', code: 'MY_CODE' } }),
      );
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.code).toBe('MY_CODE');
    });

    it('does not set err.code when error.code is not a string', async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrResponse(422, { error: { message: 'Oops', code: 999 } }),
      );
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.code).toBeUndefined();
    });

    it('falls back to body.message when error object has no message', async () => {
      mockFetch.mockResolvedValueOnce(makeErrResponse(404, { message: 'Not found', error: {} }));
      const err: any = await client.get('/missing').catch((e) => e);
      expect(err.message).toBe('Not found');
    });

    it('falls back to generic message when no message fields', async () => {
      mockFetch.mockResolvedValueOnce(makeErrResponse(400, { random: true }));
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.message).toBe('Request failed: 400');
    });

    it('attaches full body to err.body', async () => {
      const body = { error: { message: 'x', code: 'Y' } };
      mockFetch.mockResolvedValueOnce(makeErrResponse(400, body));
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.body).toEqual(body);
    });

    it('handles non-JSON error body gracefully (default message)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      } as any);
      const err: any = await client.get('/bad').catch((e) => e);
      expect(err.message).toBe('Request failed: 400');
    });
  });

  // ─── Network / Timeout Errors ─────────────────────────────────────────────────

  describe('Network / Timeout errors', () => {
    it('throws user-friendly message when fetch rejects with AbortError', async () => {
      const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValueOnce(abortErr);
      await expect(client.get('/slow')).rejects.toThrow(
        'The request is taking too long. Please check your internet.',
      );
    });

    it('throws user-friendly message on generic network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(client.get('/unreachable')).rejects.toThrow(
        'Could not reach the server. Please check your connection.',
      );
    });

    it('passes AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));
      await client.get('/x');
      const signal = mockFetch.mock.calls[0][1].signal;
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('abort callback fires after REQUEST_TIMEOUT_MS and rejects with timeout error', async () => {
      jest.useFakeTimers();
      // Mock fetch to observe the abort signal and reject when it fires
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        }),
      );
      const promise = client.get('/timing');
      // Advance past the 15-second timeout
      jest.advanceTimersByTime(15_001);
      await expect(promise).rejects.toThrow('The request is taking too long. Please check your internet.');
      jest.useRealTimers();
    });
  });

  // ─── Refresh-token flow ──────────────────────────────────────────────────────
  describe('refresh-token flow', () => {
    let getRefreshToken: jest.Mock;
    let setTokens: jest.Mock;
    let refreshClient: ApiClient;

    beforeEach(() => {
      mockFetch = jest.fn();
      (globalThis as any).fetch = mockFetch;
      jest.clearAllMocks();
      getToken.mockReturnValue('at-old');
      getRefreshToken = jest.fn(() => 'rt-old');
      setTokens = jest.fn(async () => {});
      refreshClient = new ApiClient({
        baseUrl: 'https://api.example.com/v1',
        getToken,
        getRefreshToken,
        setTokens,
        onUnauthorized,
      });
    });

    it('refreshes once on TOKEN_EXPIRED and replays the original request', async () => {
      // 1st call: 401 TOKEN_EXPIRED
      // 2nd call: refresh endpoint returns new pair
      // 3rd call: retried original request returns 200
      mockFetch
        .mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }))
        .mockResolvedValueOnce(makeOkResponse({ data: { accessToken: 'at-new', refreshToken: 'rt-new' } }))
        .mockResolvedValueOnce(makeOkResponse({ data: { hello: 'world' } }));

      // After refresh, getToken should return the new AT — simulate by
      // having setTokens update the mock's return value.
      setTokens.mockImplementation(async (pair: any) => {
        if (pair) getToken.mockReturnValue(pair.accessToken);
      });

      const result = await refreshClient.get('/protected');
      expect(result).toEqual({ hello: 'world' });
      expect(setTokens).toHaveBeenCalledWith({ accessToken: 'at-new', refreshToken: 'rt-new' });
      expect(onUnauthorized).not.toHaveBeenCalled();
      // 1st req with old AT, 2nd req refresh, 3rd req with new AT
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe('Bearer at-new');
    });

    it('does NOT refresh when 401 has TOKEN_REVOKED — calls onUnauthorized immediately', async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrResponse(401, { error: { code: 'TOKEN_REVOKED', message: 'revoked' } }),
      );
      await expect(refreshClient.get('/x')).rejects.toMatchObject({ status: 401, code: 'TOKEN_REVOKED' });
      expect(setTokens).not.toHaveBeenCalled();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry more than once if refresh succeeds but the retry still 401s', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED' } }))
        .mockResolvedValueOnce(makeOkResponse({ data: { accessToken: 'at-new', refreshToken: 'rt-new' } }))
        .mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED' } }));

      setTokens.mockImplementation(async (pair: any) => {
        if (pair) getToken.mockReturnValue(pair.accessToken);
      });

      await expect(refreshClient.get('/x')).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      // Original + refresh + 1 retry = 3 calls; never a 4th.
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('clears tokens when the refresh endpoint itself returns 401', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED' } }))
        .mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'REFRESH_REUSE_DETECTED' } }));

      await expect(refreshClient.get('/x')).rejects.toMatchObject({ status: 401 });
      expect(setTokens).toHaveBeenCalledWith(null);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent 401s into a single refresh call', async () => {
      // 4 parallel requests — all hit 401 simultaneously. Only one refresh
      // call should be made, then all 4 originals get retried with the new AT.
      mockFetch.mockImplementation(async (url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return makeOkResponse({ data: { accessToken: 'at-new', refreshToken: 'rt-new' } });
        }
        // Token still 'at-old' on first try, 'at-new' on retry — branch on
        // the call's bearer to decide the response.
        const callIdx = mockFetch.mock.calls.length - 1;
        const init = mockFetch.mock.calls[callIdx][1] as RequestInit;
        const auth = (init.headers as Record<string, string>).Authorization;
        if (auth === 'Bearer at-new') {
          return makeOkResponse({ data: { ok: true } });
        }
        return makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED' } });
      });

      setTokens.mockImplementation(async (pair: any) => {
        if (pair) getToken.mockReturnValue(pair.accessToken);
      });

      const results = await Promise.all([
        refreshClient.get('/a'),
        refreshClient.get('/b'),
        refreshClient.get('/c'),
        refreshClient.get('/d'),
      ]);
      expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
      // Exactly one refresh call across all 4 concurrent requests.
      const refreshCalls = mockFetch.mock.calls.filter((c) => (c[0] as string).endsWith('/auth/refresh'));
      expect(refreshCalls.length).toBe(1);
      expect(setTokens).toHaveBeenCalledTimes(1);
    });

    it('without getRefreshToken/setTokens configured, behaves like the legacy single-token client', async () => {
      const legacy = new ApiClient({
        baseUrl: 'https://api.example.com/v1',
        getToken,
        onUnauthorized,
      });
      mockFetch.mockResolvedValueOnce(makeErrResponse(401, { error: { code: 'TOKEN_EXPIRED' } }));
      await expect(legacy.get('/x')).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
    });
  });
});
