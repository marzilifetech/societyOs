import { ApiClient, ApiClientConfig } from '@societyos/api-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

// Friendly translations of backend auth error codes — the raw NestJS
// `UnauthorizedException` message is just "Unauthorized" which is useless
// to a user typing an OTP.
const AUTH_FRIENDLY_MESSAGES: Record<string, string> = {
  INVALID_OTP: 'The OTP you entered is incorrect or has expired. Please try again.',
  OTP_EXPIRED: 'This OTP has expired. Tap "Resend OTP" to get a new one.',
  OTP_LOCKED: 'Too many wrong attempts. Please wait a few minutes before trying again.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact your administrator.',
  SOCIETY_SUSPENDED: 'This society is currently paused. Please contact the platform team.',
  SOCIETY_ARCHIVED: 'This society has been archived and is no longer active.',
  USER_REVOKED: 'Your account is no longer active. Please contact support.',
  '2FA_INVALID_CODE': 'The authenticator code is incorrect. Please try again.',
};

function friendlyError(status: number, serverMsg?: string, serverCode?: string): Error {
  if (status === 401) {
    // Don't kick the user back to /login if they're already there — a 401
    // during the login flow itself (wrong OTP, account suspended, etc.) is
    // a normal error to render inline, not a "session expired" event.
    const onLoginPage =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
    if (!onLoginPage && typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login?reason=session-expired';
      return new Error('Your session has ended. Please sign in again.');
    }
    // On /login: surface a useful message, preferring the friendly map.
    const message =
      (serverCode && AUTH_FRIENDLY_MESSAGES[serverCode]) ??
      (serverMsg && serverMsg !== 'Unauthorized' && serverMsg !== 'Unauthorized Exception'
        ? serverMsg
        : 'Sign-in failed. Please try again.');
    const e: Error & { code?: string } = new Error(message);
    if (serverCode) e.code = serverCode;
    return e;
  }
  // Prefer API envelope messages for actionable admin errors (conflicts, transitions, etc.).
  if (serverMsg && status >= 400 && status < 500) {
    const e: Error & { code?: string } = new Error(serverMsg);
    if (serverCode) e.code = serverCode;
    return e;
  }
  if (status === 403) {
    return new Error('You do not have permission to perform this action.');
  }
  if (status === 404) {
    return new Error(serverMsg ?? 'The requested item was not found.');
  }
  if (status === 409) {
    return new Error(serverMsg ?? 'This record already exists. Please check and try again.');
  }
  if (status >= 500) {
    return new Error('Something went wrong on our end. Please try again in a moment.');
  }
  return new Error(serverMsg ?? 'An unexpected error occurred.');
}

function extractHttpErrorFields(err: any): {
  status?: number;
  message?: string;
  code?: string;
} {
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
  if (
    !message &&
    typeof rawMsg === 'string' &&
    rawMsg &&
    !/^Request failed: \d+$/.test(rawMsg)
  ) {
    message = rawMsg;
  }
  if (!code && typeof err?.code === 'string') {
    code = err.code;
  }
  return { status, message, code };
}

class AdminApiClient extends ApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  private async withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      // Network / timeout errors
      if (
        err instanceof TypeError ||
        err?.code === 'ECONNABORTED' ||
        err?.code === 'ERR_NETWORK'
      ) {
        throw new Error(
          'Could not connect to the server. Please check your internet connection and try again.',
        );
      }
      const msg: string = err?.message ?? '';
      const { status: errStatus, message: envelopeMsg, code: envelopeCode } =
        extractHttpErrorFields(err);
      const statusMatch = msg.match(/^Request failed: (\d+)/);
      const status =
        errStatus ?? (statusMatch ? Number(statusMatch[1]) : undefined);

      if (status !== undefined) {
        throw friendlyError(status, envelopeMsg, envelopeCode);
      }
      // Pass through already-friendly errors (e.g. from onUnauthorized path)
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

export const api = new AdminApiClient({
  baseUrl: BASE_URL,
  getToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_token');
  },
  // Wire refresh-token rotation so a stale access token does NOT immediately
  // log the user out. Without these two callbacks, client.ts:tryRefresh
  // early-returns null and fires onUnauthorized() → /login bounce. The keys
  // here must stay in sync with auth.store.ts (ACCESS_KEY, REFRESH_KEY).
  getRefreshToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_refresh_token');
  },
  setTokens: (pair) => {
    if (typeof window === 'undefined') return;
    if (pair === null) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      return;
    }
    localStorage.setItem('admin_token', pair.accessToken);
    localStorage.setItem('admin_refresh_token', pair.refreshToken);
  },
  getExtraHeaders: () => {
    if (typeof window === 'undefined') return {};
    const societyId = localStorage.getItem('admin_selected_society_id');
    if (!societyId) return {};
    const headers: Record<string, string> = { 'X-Society-Id': societyId };
    // C1: never stamp X-ReAuth-Confirmed automatically — it was trivially
    // spoofable and defeated the tenant-switch gate. Instead, the
    // SocietySwitcher writes a short-lived one-shot reauth token to
    // sessionStorage; we forward it ONCE (the backend consumes the jti).
    const reauth = sessionStorage.getItem('admin_reauth_token');
    if (reauth) {
      headers['X-ReAuth-Token'] = reauth;
      // Drop after read — the backend is one-shot anyway, but this keeps
      // dev tools from showing a stale token after the switch lands.
      sessionStorage.removeItem('admin_reauth_token');
    }
    return headers;
  },
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login?reason=session-expired';
    }
  },
});

/** Download a CSV/binary admin endpoint with auth + tenant headers. */
export async function downloadAdminFile(path: string, filename: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('admin_token');
  const societyId = localStorage.getItem('admin_selected_society_id');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (societyId) {
    headers['X-Society-Id'] = societyId;
    const reauth = sessionStorage.getItem('admin_reauth_token');
    if (reauth) {
      headers['X-ReAuth-Token'] = reauth;
      sessionStorage.removeItem('admin_reauth_token');
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    throw new Error('Could not download file. Please try again.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
