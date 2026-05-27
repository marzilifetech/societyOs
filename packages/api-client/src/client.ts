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
