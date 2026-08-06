import {
  Injectable,
  Logger,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * Tokens issued by Marzi. Dual-envelope: legacy mobile clients read
 * `data.access`/`data.refresh`; new clients read `accessToken`/`refreshToken`.
 * Both are the same JWT value. We standardise on the top-level names.
 */
export interface MarziTokenPair {
  accessToken: string;
  refreshToken: string;
  userId?: string;
  isPioneer?: boolean;
  isOnboardCompleted?: boolean;
}

/**
 * Thin client for the external Marzi Senior Community auth API
 * (https://dev.marzitech.in — see backend/POSTMAN.json › Auth).
 *
 * Scope: Marzi is used ONLY as the OTP channel at login. SocietyOS mints its
 * OWN local JWTs (JWT_SECRET stays independent — no shared secret with Marzi)
 * and owns the user records + society/role gates. verify-otp does NOT pass
 * Marzi's tokens through to the client; it parks Marzi's refresh/access in
 * Redis so /auth/refresh can re-validate the session against Marzi (Marzi as
 * the "is this user still allowed" authority) while the client only ever sees
 * SocietyOS tokens. See docs/AUTH-SECURITY-TRADEOFF.md for the rationale.
 *
 * Activated by OTP_PROVIDER=marzi; otherwise dormant (the client returns
 * `enabled=false` and AuthService falls back to its local OTP+JWT path).
 */
@Injectable()
export class MarziAuthClient {
  private readonly logger = new Logger(MarziAuthClient.name);
  private readonly baseUrl: string;
  private readonly tenantName: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = (this.config.get<string>('MARZI_AUTH_BASE_URL') || '').replace(/\/+$/, '');
    this.tenantName = this.config.get<string>('MARZI_TENANT_NAME') || 'Marzi';
  }

  /** True when OTP delivery/verification should be delegated to Marzi. */
  get enabled(): boolean {
    return this.config.get<string>('OTP_PROVIDER') === 'marzi';
  }

  /** Send a 4-digit OTP. Tenant errors (TENANT_NOT_FOUND / TENANT_INACTIVE) propagate. */
  async sendOtp(phone: string): Promise<void> {
    await this.post('/v1/auth/send-otp', { phone, tenant_name: this.tenantName });
  }

  /**
   * Verify an OTP against the external backend.
   * @returns null if the OTP is wrong/expired (4xx). Otherwise the full
   * Marzi token pair — caller persists these and returns them to the client.
   * Tenant misconfiguration and 5xx/network failures are thrown.
   */
  async verifyOtp(phone: string, otp: string): Promise<MarziTokenPair | null> {
    try {
      const raw = (await this.post('/v1/auth/verify-otp', {
        phone,
        otp,
        tenant_name: this.tenantName,
      })) as Record<string, any>;
      return this.normalisePair(raw);
    } catch (err) {
      if (err instanceof HttpException) {
        const status = err.getStatus();
        const code = (err.getResponse() as { code?: string })?.code;
        // A tenant problem is an operator misconfiguration — surface it.
        if (code === 'TENANT_NOT_FOUND' || code === 'TENANT_INACTIVE') {
          throw err;
        }
        if (status >= 400 && status < 500) {
          return null;
        }
      }
      throw err;
    }
  }

  /**
   * Exchange a Marzi refresh token for a new Marzi pair. Marzi rotates
   * both tokens — the old refresh is invalid after this call.
   * Throws on any 4xx/5xx so callers can surface a meaningful error code
   * (401 = USER_REVOKED locally; 403 = account SUSPENDED).
   */
  async refresh(refreshToken: string): Promise<MarziTokenPair> {
    const url = `${this.baseUrl}/v1/auth/refresh`;
    if (!this.baseUrl) {
      this.logger.error('OTP_PROVIDER=marzi but MARZI_AUTH_BASE_URL is not set');
      throw new ServiceUnavailableException({ code: 'MARZI_AUTH_NOT_CONFIGURED' });
    }
    try {
      const res = await firstValueFrom(
        this.http.post(
          url,
          {},
          {
            timeout: 10_000,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refreshToken}`,
            },
          },
        ),
      );
      const raw = (res.data ?? {}) as Record<string, any>;
      return this.normalisePair(raw);
    } catch (err) {
      const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
      if (ax.response) {
        const status = ax.response.status;
        const ext = ax.response.data?.error;
        throw new HttpException(
          { code: ext?.code || 'MARZI_REFRESH_FAILED', message: ext?.message },
          status,
        );
      }
      this.logger.error(`Marzi refresh unreachable: ${ax.message}`);
      throw new ServiceUnavailableException({ code: 'MARZI_AUTH_UNREACHABLE' });
    }
  }

  /**
   * Pull tokens out of Marzi's dual-envelope response shape:
   *   { accessToken, refreshToken, userId?, isPioneer?, is_onboard_completed?,
   *     data: { access, refresh, is_onboard_completed? }, access, refresh }
   * New clients should read the top-level `accessToken`/`refreshToken`.
   */
  private normalisePair(raw: Record<string, any>): MarziTokenPair {
    const accessToken =
      raw.accessToken ?? raw.access ?? raw.data?.access ?? raw.data?.accessToken;
    const refreshToken =
      raw.refreshToken ?? raw.refresh ?? raw.data?.refresh ?? raw.data?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new ServiceUnavailableException({
        code: 'MARZI_RESPONSE_MALFORMED',
        message: 'Marzi did not return access/refresh tokens',
      });
    }
    return {
      accessToken,
      refreshToken,
      userId: raw.userId ?? raw.user_id ?? raw.data?.userId,
      isPioneer: raw.isPioneer ?? raw.is_pioneer,
      isOnboardCompleted:
        raw.is_onboard_completed ?? raw.data?.is_onboard_completed ?? raw.isOnboardCompleted,
    };
  }

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.baseUrl) {
      this.logger.error('OTP_PROVIDER=marzi but MARZI_AUTH_BASE_URL is not set');
      throw new ServiceUnavailableException({ code: 'MARZI_AUTH_NOT_CONFIGURED' });
    }
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.baseUrl}${path}`, body, {
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return res.data;
    } catch (err) {
      const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
      if (ax.response) {
        const status = ax.response.status;
        const ext = ax.response.data?.error;
        // Re-raise with the external error code so callers can branch on it.
        throw new HttpException(
          { code: ext?.code || 'MARZI_AUTH_ERROR', message: ext?.message },
          status,
        );
      }
      this.logger.error(`Marzi auth ${path} unreachable: ${ax.message}`);
      throw new ServiceUnavailableException({ code: 'MARZI_AUTH_UNREACHABLE' });
    }
  }
}
