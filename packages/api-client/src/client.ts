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
 * Backend error codes that mean "the access token is expired but the session
 * may still be valid" — these trigger a refresh attempt. Anything else on a
 * 401 (token revoked, refresh family revoked, replay detected, malformed
 * token) is a hard failure and the user must sign in again.
 */
const REFRESHABLE_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_SKEW']);

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
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
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
        // Network error during refresh — don't wipe tokens; let the caller
        // surface the network-error path. Returning null still falls through
        // to onUnauthorized though, so distinguish: only wipe on a 4xx above.
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

    if (res.status === 401) {
      // Inspect the envelope to decide whether to refresh or hard-logout.
      let code: string | undefined;
      try {
        const serverBody = await res.json();
        code = serverBody?.error?.code;
      } catch {
        /* not JSON */
      }

      const canRefresh =
        !_retried &&
        !!this.config.getRefreshToken &&
        !!this.config.setTokens &&
        // Treat 401 with no code as legacy/ambiguous — try a refresh once.
        (code === undefined || REFRESHABLE_CODES.has(code));

      if (canRefresh) {
        const newAccess = await this.tryRefresh();
        if (newAccess) {
          // Retry once with the fresh token.
          return this.request<T>(method, path, body, true);
        }
      }

      this.config.onUnauthorized?.();
      const e: any = new Error('Your session ended. Please sign in again.');
      e.status = 401;
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
