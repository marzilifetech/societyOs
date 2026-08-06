import { ApiClient, ApiClientConfig } from '@societyos/api-client';

/**
 * Resident "Care" portal API client — deliberately SEPARATE from the admin
 * `lib/api.ts` singleton. Residents authenticate with their own phone/OTP and
 * get their own token namespace (`care_*`), so the two identities never collide
 * in one browser. Unlike the admin client this sends NO `X-Society-Id` header:
 * a resident's society is baked into their JWT and resolved server-side.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export const CARE_ACCESS_KEY = 'care_token';
export const CARE_REFRESH_KEY = 'care_refresh_token';

const AUTH_FRIENDLY_MESSAGES: Record<string, string> = {
  INVALID_OTP: 'The OTP you entered is incorrect or has expired. Please try again.',
  OTP_EXPIRED: 'This OTP has expired. Tap "Resend" to get a new one.',
  OTP_LOCKED: 'Too many wrong attempts. Please wait a few minutes and try again.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact your society office.',
  SOCIETY_SUSPENDED: 'This society is currently paused. Please contact your society office.',
  SOCIETY_ARCHIVED: 'This society is no longer active.',
  USER_REVOKED: 'Your account is no longer active. Please contact your society office.',
};

function friendlyError(status: number, serverMsg?: string, serverCode?: string): Error {
  if (status === 401) {
    const onLogin =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/care/login');
    if (!onLogin && typeof window !== 'undefined') {
      localStorage.removeItem(CARE_ACCESS_KEY);
      localStorage.removeItem(CARE_REFRESH_KEY);
      localStorage.removeItem('care-auth');
      window.location.href = '/care/login?reason=session-expired';
      return new Error('Your session has ended. Please sign in again.');
    }
    const message =
      (serverCode && AUTH_FRIENDLY_MESSAGES[serverCode]) ??
      (serverMsg && !/^Unauthorized/.test(serverMsg) ? serverMsg : 'Sign-in failed. Please try again.');
    const e: Error & { code?: string } = new Error(message);
    if (serverCode) e.code = serverCode;
    return e;
  }
  if (status === 429) {
    return new Error(serverMsg || 'Too many requests — please wait a few seconds and try again.');
  }
  if (serverMsg && status >= 400 && status < 500) {
    const e: Error & { code?: string } = new Error(serverMsg);
    if (serverCode) e.code = serverCode;
    return e;
  }
  if (status === 403) return new Error(serverMsg ?? 'You do not have access to this yet.');
  if (status === 404) return new Error(serverMsg ?? 'Not found.');
  if (status === 503) return new Error('Service is temporarily unavailable. Please try again shortly.');
  if (status >= 500) return new Error('Something went wrong on our end. Please try again in a moment.');
  return new Error(serverMsg ?? 'An unexpected error occurred.');
}

function extractHttpErrorFields(err: any): { status?: number; message?: string; code?: string } {
  const status = typeof err?.status === 'number' ? err.status : undefined;
  const body = err?.body;
  let message: string | undefined;
  let code: string | undefined;
  if (body?.error && typeof body.error === 'object') {
    const e = body.error as Record<string, unknown>;
    if (typeof e.message === 'string') message = e.message;
    if (typeof e.code === 'string') code = e.code;
  }
  const rawMsg = err?.message;
  if (!message && typeof rawMsg === 'string' && rawMsg && !/^Request failed: \d+$/.test(rawMsg)) {
    message = rawMsg;
  }
  if (!code && typeof err?.code === 'string') code = err.code;
  return { status, message, code };
}

class CareApiClient extends ApiClient {
  private async withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (err instanceof TypeError || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK') {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        throw new Error(
          offline
            ? "You're offline. We'll retry automatically once you're back online."
            : 'The server is unreachable. Please retry in a moment.',
        );
      }
      const msg: string = err?.message ?? '';
      const { status: errStatus, message: envelopeMsg, code: envelopeCode } = extractHttpErrorFields(err);
      const statusMatch = msg.match(/^Request failed: (\d+)/);
      const status = errStatus ?? (statusMatch ? Number(statusMatch[1]) : undefined);
      if (status !== undefined) throw friendlyError(status, envelopeMsg, envelopeCode);
      throw err;
    }
  }

  override get<T>(path: string): Promise<T> {
    return this.withErrorHandling(() => super.get<T>(path));
  }
  override post<T>(path: string, body?: unknown): Promise<T> {
    return this.withErrorHandling(() => super.post<T>(path, body));
  }
  override patch<T>(path: string, body?: unknown): Promise<T> {
    return this.withErrorHandling(() => super.patch<T>(path, body));
  }
  override put<T>(path: string, body?: unknown): Promise<T> {
    return this.withErrorHandling(() => super.put<T>(path, body));
  }
  override delete<T>(path: string): Promise<T> {
    return this.withErrorHandling(() => super.delete<T>(path));
  }
}

const config: ApiClientConfig = {
  baseUrl: BASE_URL,
  getToken: () => (typeof window === 'undefined' ? null : localStorage.getItem(CARE_ACCESS_KEY)),
  getRefreshToken: () =>
    typeof window === 'undefined' ? null : localStorage.getItem(CARE_REFRESH_KEY),
  setTokens: (pair) => {
    if (typeof window === 'undefined') return;
    if (pair === null) {
      localStorage.removeItem(CARE_ACCESS_KEY);
      localStorage.removeItem(CARE_REFRESH_KEY);
      return;
    }
    localStorage.setItem(CARE_ACCESS_KEY, pair.accessToken);
    localStorage.setItem(CARE_REFRESH_KEY, pair.refreshToken);
  },
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CARE_ACCESS_KEY);
      localStorage.removeItem(CARE_REFRESH_KEY);
      localStorage.removeItem('care-auth');
      window.location.href = '/care/login?reason=session-expired';
    }
  },
};

export const careApi = new CareApiClient(config);

/** Absolute base for manual fetch/upload/socket needs. */
export const CARE_API_BASE = BASE_URL;
