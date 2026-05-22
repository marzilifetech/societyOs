import { ApiClient, ApiClientConfig } from '@societyos/api-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

function friendlyError(status: number, serverMsg?: string, serverCode?: string): Error {
  if (status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login?reason=session-expired';
    }
    return new Error('Your session has ended. Please sign in again.');
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
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login?reason=session-expired';
    }
  },
});
