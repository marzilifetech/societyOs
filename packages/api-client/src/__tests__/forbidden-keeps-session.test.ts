import { ApiClient } from '../client';

/**
 * A 403 must never cost the user their session.
 *
 * Being refused ONE resource is an authorisation answer. Being logged out is
 * an authentication one. Conflating them is how "you cannot see billing"
 * turned into "your session expired, sign in again".
 *
 * This mattered little while 403s were rare. Once permissions shipped, a 403
 * became the ROUTINE answer for a correctly-scoped admin — an accountant
 * opening a staff page, a block admin opening billing. The old code refreshed
 * on every one of those, and a rejected refresh wiped the tokens, so the next
 * call 401'd and bounced them to /login?reason=session-expired.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('403 handling — session must survive', () => {
  let setTokens: jest.Mock;
  let getRefreshToken: jest.Mock;
  let onUnauthorized: jest.Mock;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    setTokens = jest.fn().mockResolvedValue(undefined);
    getRefreshToken = jest.fn().mockReturnValue('refresh-token-1');
    onUnauthorized = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function makeClient(fetchImpl: typeof fetch) {
    global.fetch = fetchImpl;
    return new ApiClient({
      baseUrl: 'https://api.test',
      getToken: () => 'valid-access',
      getRefreshToken,
      setTokens,
      onUnauthorized,
    });
  }

  it('does not attempt a refresh on 403', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'Missing permission: billing:read' } }),
    ) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);

    await expect(client.get('/admin/maintenance/bills')).rejects.toThrow();

    // Exactly one call: the original request. No refresh round-trip. With 89
    // permission-gated routes, an extra hop on every legitimate 403 is a real
    // cost paid by exactly the narrow-scoped admins the feature is built for.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not clear tokens on 403', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, { error: { code: 'FORBIDDEN' } }),
    ) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);

    await expect(client.get('/admin/staff')).rejects.toThrow();

    // The regression that logged admins out: tryRefresh() treated a rejected
    // refresh as terminal and called setTokens(null), so the NEXT request had
    // no token at all.
    expect(setTokens).not.toHaveBeenCalledWith(null);
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('does not fire onUnauthorized on 403', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, { error: { code: 'FORBIDDEN' } }),
    ) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);

    await expect(client.get('/admin/complaints')).rejects.toThrow();

    // onUnauthorized is the hard bounce to /login. A forbidden resource must
    // leave the user exactly where they are.
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('surfaces the server message so the UI can explain the refusal', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, {
        error: { code: 'FORBIDDEN', message: 'Missing permission: staff:read' },
      }),
    ) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);

    // Naming the missing permission is the difference between a one-minute fix
    // and a support ticket — it must reach the caller, not be swallowed.
    await expect(client.get('/admin/staff')).rejects.toThrow(/staff:read/);
  });

  it('still refreshes on 401 — a genuinely expired token is different', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call++;
      if (call === 1) return jsonResponse(401, { error: { code: 'TOKEN_EXPIRED' } });
      if (call === 2)
        return jsonResponse(200, {
          data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' },
        });
      return jsonResponse(200, { data: { ok: true } });
    }) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);

    await expect(client.get('/admin/residents')).resolves.toEqual({ ok: true });
    expect(setTokens).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
