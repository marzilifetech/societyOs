import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Gates the OTP routes (/auth/send-otp, /auth/verify-otp).
 *
 * The routes are exposed when EITHER:
 *   - AUTH_LOCAL_OTP_ENABLED=true — in-house Redis OTP (dev/test convenience), or
 *   - OTP_PROVIDER=marzi          — the routes proxy to the external Marzi
 *                                   Senior Community backend (see POSTMAN.json).
 *
 * Otherwise they return 404 — indistinguishable from a removed endpoint to any
 * caller. Both flags default off, so prod must opt in explicitly.
 */
@Injectable()
export class LocalOtpEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_ctx: ExecutionContext): boolean {
    const localEnabled = this.config.get<boolean>('AUTH_LOCAL_OTP_ENABLED');
    const marziProxy = this.config.get<string>('OTP_PROVIDER') === 'marzi';
    if (!localEnabled && !marziProxy) {
      throw new NotFoundException();
    }
    return true;
  }
}
