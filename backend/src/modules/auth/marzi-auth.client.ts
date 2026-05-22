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
 * Thin client for the external Marzi Senior Community auth API
 * (https://dev.marzitech.in — see backend/POSTMAN.json › Auth).
 *
 * SocietyOS uses this ONLY to delegate OTP delivery + verification. The
 * external JWTs returned by /verify-otp are deliberately discarded —
 * AuthService still mints SocietyOS-local tokens, so no shared JWT secret
 * with the external backend is required.
 *
 * Activated by OTP_PROVIDER=marzi; otherwise dormant.
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
   * @returns true if the OTP is valid, false if it is wrong/expired.
   * Tenant misconfiguration and 5xx/network failures are thrown, never
   * silently downgraded to "invalid OTP".
   */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    try {
      await this.post('/v1/auth/verify-otp', {
        phone,
        otp,
        tenant_name: this.tenantName,
      });
      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        const status = err.getStatus();
        const code = (err.getResponse() as { code?: string })?.code;
        // A tenant problem is an operator misconfiguration — surface it.
        if (code === 'TENANT_NOT_FOUND' || code === 'TENANT_INACTIVE') {
          throw err;
        }
        // Any other 4xx (wrong / expired OTP) → not valid.
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      throw err;
    }
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
