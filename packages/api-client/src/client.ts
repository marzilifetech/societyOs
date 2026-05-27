const REQUEST_TIMEOUT_MS = 15_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  /** Returns the current refresh token if the app supports refresh-token rotation. */
  getRefreshToken?: () => string | null;
  /**
   * Persist a new access/refresh pair, or clear all auth state when called with `null`.
   * Called by the client after a successful refresh, and after a hard auth failure.
   */
  setTokens?: (pair: TokenPair | null) => Promise<void> | void;
  /** Override the refresh endpoint path. Defaults to `/auth/refresh`. */
  refreshUrl?: string;
  /** Called when authentication has hard-failed (refresh attempted and rejected). */
  onUnauthorized?: () => void;
  /** Optional extra headers (e.g. super-admin tenant switch). */
  getExtraHeaders?: () => Record<string, string>;
}

/**
 * Backend error codes that mean "the access token is expired or stale, but
 * the session may still be valid" — refresh and retry once. Anything else
 * (USER_REVOKED, REFRESH_REUSE_DETECTED, malformed token, INVALID_REFRESH)
 * is a hard sign-out.
 *
 * REAUTH_REQUIRED is included because the backend's super-admin tenant-switch
 * gate fires when the access token's `iat` is older than the fresh-login
 * window. A successful refresh produces a token with a new `iat` (fresh by
 * definition), so retrying after refresh passes the gate without needing
 * the user to enter another OTP.
 *
 * REAUTH_REQUIRES_VALID_BEARER fires when the bearer signature is invalid
 * at the middleware pre-check (before JwtAuthGuard). Refreshing produces
 * a fresh, properly-signed bearer that clears this too.
 */
const REFRESHABLE_CODES = new Set([
  'TOKEN_EXPIRED',
  'TOKEN_SKEW',
  'REAUTH_REQUIRED',
  'REAUTH_REQUIRES_VALID_BEARER',
]);

export class ApiClient {
  private config: ApiClientConfig;
  /** In-flight refresh promise — concurrent 401s share a single refresh call. */
  private _refreshInFlight: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private async tryRefresh(): Promise<string | null> {
    if (!this.config.getRefreshToken || !this.config.setTokens) return null;
    if (this._refreshInFlight) return this._refreshInFlight;

    this._refreshInFlight = (async () => {
      try {
        const refreshToken = this.config.getRefreshToken!();
        if (!refreshToken) return null;
        const url = `${this.config.baseUrl}${this.config.refreshUrl ?? '/auth/refresh'}`;

        // Up to 3 attempts with backoff so a single network blip or transient
        // 5xx on the refresh endpoint does not sign the user out unnecessarily.
        // We only retry on network errors and 5xx — 4xx is treated as terminal
        // immediately (the server has made a definitive decision).
        const MAX_ATTEMPTS = 3;
        const BACKOFF_MS = [0, 400, 1200];
        let res: Response | null = null;
        let lastNetworkError: unknown = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (BACKOFF_MS[attempt] > 0) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
          }
          try {
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
          } catch (err) {
            lastNetworkError = err;
            res = null;
            continue;
          }
          // Retry on 5xx only — 4xx is definitive.
          if (res.status < 500) break;
        }

        if (!res) {
          // All attempts failed at the network layer — do NOT wipe tokens.
          // The refresh JWT is still valid; the user can retry when online.
          void lastNetworkError;
          return null;
        }
        if (!res.ok) {
          // Definitive server rejection — terminal.
          await this.config.setTokens!(null);
          return null;
        }
        const json: any = await res.json().catch(() => null);
        const data = json?.data ?? json;
        const accessToken = data?.accessToken ?? data?.token;
        const newRefresh = data?.refreshToken;
        if (!accessToken || !newRefresh) {
          await this.config.setTokens!(null);
          return null;
        }
        await this.config.setTokens!({ accessToken, refreshToken: newRefresh });
        return accessToken;
      } catch {
        // Defensive: anything unexpected — don't wipe tokens. Caller will
        // surface the error path; user can retry.
        return null;
      } finally {
        this._refreshInFlight = null;
      }
    })();

    return this._refreshInFlight;
  }

  private async request<T>(method: string, path: string, body?: unknown, _retried = false): Promise<T> {
    const token = this.config.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const extra = this.config.getExtraHeaders?.() ?? {};
    Object.assign(headers, extra);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        throw new Error('The request is taking too long. Please check your internet.');
      }
      throw new Error('Could not reach the server. Please check your connection.');
    } finally {
      clearTimeout(timeoutId);
    }

    // Auth-related failures can land as either 401 (expired/invalid bearer)
    // OR 400 (e.g. REAUTH_REQUIRED — bearer valid but `iat` too old for a
    // privileged action). For 4xx with one of the refreshable codes, attempt
    // a silent refresh + retry once. Pure-401 with no code is treated as
    // legacy/ambiguous and refresh is also tried.
    if (res.status === 401 || res.status === 400) {
      let code: string | undefined;
      let serverBody: any;
      try {
        serverBody = await res.json();
        code = serverBody?.error?.code;
      } catch {
        /* not JSON */
      }

      // 401 default = try refresh; 400 only when the code is one we recognise
      // as auth-related (don't refresh on every random 400!).
      const isAuth4xx =
        res.status === 401
          ? code === undefined || REFRESHABLE_CODES.has(code)
          : !!code && REFRESHABLE_CODES.has(code);

      const canRefresh =
        !_retried &&
        !!this.config.getRefreshToken &&
        !!this.config.setTokens &&
        isAuth4xx;

      if (canRefresh) {
        const newAccess = await this.tryRefresh();
        if (newAccess) {
          // Retry once with the fresh token.
          return this.request<T>(method, path, body, true);
        }
      }

      // If this wasn't an auth 4xx, fall through to the generic error path
      // below so the caller sees the real message (e.g. validation errors).
      if (res.status === 400 && !isAuth4xx) {
        const e: any = new Error(serverBody?.error?.message ?? `Request failed: 400`);
        e.status = 400;
        e.body = serverBody;
        if (code) e.code = code;
        throw e;
      }

      this.config.onUnauthorized?.();
      const e: any = new Error('Your session ended. Please sign in again.');
      e.status = res.status;
      if (code) e.code = code;
      throw e;
    }

    if (res.status >= 500) {
      const e: any = new Error('Something went wrong. Please try again in a moment.');
      e.status = res.status;
      throw e;
    }

    if (!res.ok) {
      let message = `Request failed: ${res.status}`;
      let serverBody: any;
      try {
        serverBody = await res.json();
        const envErr = serverBody?.error;
        if (envErr && typeof envErr.message === 'string') {
          message = envErr.message;
        } else if (typeof serverBody?.message === 'string') {
          message = serverBody.message;
        }
      } catch {
        /* ignore non-JSON bodies */
      }
      const e: any = new Error(message);
      e.status = res.status;
      e.body = serverBody;
      const code = serverBody?.error?.code;
      if (typeof code === 'string') {
        e.code = code;
      }
      throw e;
    }

    if (res.status === 204) return undefined as T;
    const json = await res.json();
    // Backend wraps all responses in { data, meta, error }. Unwrap if present.
    return (json?.data !== undefined ? json.data : json) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
