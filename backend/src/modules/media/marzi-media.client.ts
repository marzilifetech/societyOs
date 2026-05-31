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
import { AuthRedis } from '../auth/redis.client';

export type MediaVisibility = 'public' | 'private';

export interface CreateMediaDto {
  filename: string;
  content_type: string;
  visibility: MediaVisibility;
}

/** S3 presigned-POST descriptor returned by Marzi for the browser/app to use. */
export interface MediaUploadTarget {
  method: 'POST';
  url: string;
  fields: Record<string, string>;
}

export interface CreateMediaResult {
  asset_id: string;
  kind: string;
  visibility: MediaVisibility;
  s3_key: string;
  public_url: string | null;
  status_state: string;
  upload: MediaUploadTarget;
}

export interface ConfirmMediaResult {
  asset_id: string;
  kind: string;
  visibility: MediaVisibility;
  s3_key: string;
  public_url: string | null;
  size_bytes?: number;
  status_state: string;
}

/**
 * Server-to-server client for the external Marzi media service
 * (`POST /v1/media`, `POST /v1/media/:id/confirm`). See the "Media" folder in
 * `Marzi Senior Community — Unified API.postman_collection.json`.
 *
 * Auth model: Marzi's media endpoints require a *Marzi-signed* JWT. SocietyOS
 * clients only ever hold a LOCAL JWT (signed with our own JWT_SECRET, which is
 * deliberately NOT shared with Marzi — see auth.service.ts). So we cannot
 * forward the caller's bearer. Instead AuthService parks the user's Marzi
 * access token in Redis at `marzi:access:{userId}` (written at verify-otp and
 * on every Marzi-backed refresh) and this client reads it to authenticate on
 * the user's behalf. No extra Marzi refresh rotation happens here, so there is
 * no race with the /auth/refresh flow.
 *
 * IMPORTANT: the whole Marzi backend (Auth, Media, Groups, …) lives behind a
 * SINGLE base URL (one API Gateway). Media therefore uses the exact same
 * MARZI_AUTH_BASE_URL as the OTP/auth client — e.g. https://dev.marzitech.in in
 * dev. This also guarantees the parked access token (minted by that same host)
 * is accepted. There is no separate media host.
 */
@Injectable()
export class MarziMediaClient {
  private readonly logger = new Logger(MarziMediaClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly redis: AuthRedis,
  ) {
    // Identical resolution to MarziAuthClient — one unified Marzi base URL.
    this.baseUrl = (this.config.get<string>('MARZI_AUTH_BASE_URL') || '').replace(/\/+$/, '');
  }

  static marziAccessKey(userId: string): string {
    return `marzi:access:${userId}`;
  }

  /** Create a media asset + presigned S3 upload target for the given user. */
  async createMedia(userId: string, dto: CreateMediaDto): Promise<CreateMediaResult> {
    const token = await this.requireMarziToken(userId);
    const data = await this.post(`/v1/media`, dto, token);
    return (data?.data ?? data) as CreateMediaResult;
  }

  /** Flip a PENDING asset to ACTIVE once the file is in S3. */
  async confirmMedia(userId: string, assetId: string): Promise<ConfirmMediaResult> {
    const token = await this.requireMarziToken(userId);
    const data = await this.post(`/v1/media/${encodeURIComponent(assetId)}/confirm`, {}, token);
    return (data?.data ?? data) as ConfirmMediaResult;
  }

  private async requireMarziToken(userId: string): Promise<string> {
    const token = await this.redis.get(MarziMediaClient.marziAccessKey(userId));
    if (!token) {
      // No parked Marzi token (token expired, or a legacy session that predates
      // marzi:access storage). The next /auth/refresh re-parks one; surface a
      // 503 so the client shows a transient error rather than a hard logout.
      throw new ServiceUnavailableException({
        code: 'MEDIA_AUTH_UNAVAILABLE',
        message: 'Media session is not ready. Please try again in a moment or sign in again.',
      });
    }
    return token;
  }

  private async post(
    path: string,
    body: unknown,
    token: string,
  ): Promise<Record<string, any>> {
    if (!this.baseUrl) {
      this.logger.error('Marzi media called but MARZI_AUTH_BASE_URL is not set');
      throw new ServiceUnavailableException({ code: 'MARZI_MEDIA_NOT_CONFIGURED' });
    }
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.baseUrl}${path}`, body, {
          timeout: 15_000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      return (res.data ?? {}) as Record<string, any>;
    } catch (err) {
      const ax = err as AxiosError<{ error_code?: string; message?: string }>;
      if (ax.response) {
        const status = ax.response.status;
        const code = ax.response.data?.error_code || 'MARZI_MEDIA_ERROR';
        const message = ax.response.data?.message;
        // Re-raise with Marzi's own error code so the client can branch.
        throw new HttpException({ code, message }, status);
      }
      this.logger.error(`Marzi media ${path} unreachable: ${ax.message}`);
      throw new ServiceUnavailableException({ code: 'MARZI_MEDIA_UNREACHABLE' });
    }
  }
}
