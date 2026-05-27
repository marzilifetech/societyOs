import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { AuthRedis } from './redis.client';
import { MarziAuthClient } from './marzi-auth.client';

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const OTP_MAX_FAILED = 5;
const OTP_RATE_WINDOW_SECONDS = 60;
const OTP_RATE_MAX = 10; // 10/min/phone

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly isDev: boolean;

  constructor(
    private config: ConfigService,
    private redis: AuthRedis,
    private marzi: MarziAuthClient,
  ) {
    this.isDev = config.get('NODE_ENV') !== 'production';

    if (!admin.apps.length) {
      const serviceAccount = config.get('FIREBASE_SERVICE_ACCOUNT');
      if (serviceAccount) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
        } catch (e) {
          this.logger.warn(`Firebase init failed: ${(e as Error).message}`);
        }
      }
    }
  }

  /** Generate and persist an OTP for the given phone (local mode). */
  async sendOtp(phone: string): Promise<string> {
    // OTP_PROVIDER=marzi — delegate delivery to the external Marzi backend.
    // It owns rate limiting, lockout and the OTP lifecycle in this mode.
    if (this.marzi.enabled) {
      await this.marzi.sendOtp(phone);
      return 'marzi-session';
    }

    // Rate limit: 10/min/phone
    const rate = await this.redis.incr(`otp:rate:${phone}`, OTP_RATE_WINDOW_SECONDS);
    if (rate > OTP_RATE_MAX) {
      throw new HttpException(
        { code: 'OTP_RATE_LIMITED', message: 'Too many OTP requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Lockout check
    const locked = await this.redis.get(`otp:lock:${phone}`);
    if (locked) {
      const ttl = await this.redis.ttl(`otp:lock:${phone}`);
      throw new ForbiddenException({
        code: 'OTP_LOCKED',
        message: 'Phone temporarily locked due to failed attempts',
        retryAfterSeconds: ttl,
      });
    }

    if (this.isDev) {
      // 4 digits to match the mobile + admin login inputs. The Marzi proxy
      // path also uses 4-digit OTPs, so frontend and local dev are aligned.
      const code = '1234';
      await this.redis.set(`otp:code:${phone}`, code, OTP_TTL_SECONDS);
      this.logger.log(`[DEV] OTP for ${phone}: ${code}`);
      return 'dev-session';
    }

    // SMS has been removed — local OTP mode has no delivery channel. Real
    // deploys use OTP_PROVIDER=marzi (handled above). The code is stored so
    // any future in-house channel can pick it up, but it is not delivered here.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.set(`otp:code:${phone}`, code, OTP_TTL_SECONDS);
    this.logger.warn(
      `OTP generated for ${phone} but no delivery channel is configured ` +
        `(SMS removed — set OTP_PROVIDER=marzi for external delivery).`,
    );
    return 'no-delivery';
  }

  /** Verify OTP previously sent. Returns true on match, throws on lockout. */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    // OTP_PROVIDER=marzi — verification happens on the external Marzi backend.
    if (this.marzi.enabled) {
      return this.marzi.verifyOtp(phone, otp);
    }

    const locked = await this.redis.get(`otp:lock:${phone}`);
    if (locked) {
      const ttl = await this.redis.ttl(`otp:lock:${phone}`);
      throw new ForbiddenException({
        code: 'OTP_LOCKED',
        retryAfterSeconds: ttl,
      });
    }

    const stored = await this.redis.get(`otp:code:${phone}`);
    if (!stored) {
      // A1: distinguish expired vs never-issued
      throw new HttpException(
        { code: 'OTP_EXPIRED', message: 'OTP expired or not issued' },
        HttpStatus.GONE,
      );
    }

    if (stored !== otp) {
      const fails = await this.redis.incr(`otp:fails:${phone}`, OTP_LOCKOUT_SECONDS);
      if (fails >= OTP_MAX_FAILED) {
        await this.redis.set(`otp:lock:${phone}`, '1', OTP_LOCKOUT_SECONDS);
        await this.redis.del(`otp:fails:${phone}`);
        await this.redis.del(`otp:code:${phone}`);
        throw new ForbiddenException({
          code: 'OTP_LOCKED',
          message: 'Too many failed attempts; locked for 15 minutes',
          retryAfterSeconds: OTP_LOCKOUT_SECONDS,
        });
      }
      return false;
    }

    // Success — clear state
    await this.redis.del(`otp:code:${phone}`);
    await this.redis.del(`otp:fails:${phone}`);
    return true;
  }

  async verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!admin.apps.length) {
      throw new InternalServerErrorException('Firebase not initialized');
    }
    return admin.auth().verifyIdToken(idToken);
  }

  /** @deprecated kept for backwards compat with old call sites */
  async verifyDevOtp(otp: string): Promise<boolean> {
    return this.isDev && otp === '1234';
  }
}
