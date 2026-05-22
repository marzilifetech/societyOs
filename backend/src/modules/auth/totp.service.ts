import {
  Injectable,
  Logger,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthRedis } from './redis.client';
import { UserRole } from '@prisma/client';

/**
 * TOTP (RFC 6238) service backed by `otplib`. Admin-only enable/disable.
 * Pending secrets live in Redis for 10 minutes (A9: setup abandoned -> discarded).
 *
 * Note: Uses the dynamic require pattern so the app boots even if otplib is
 * not yet installed in dev. Verify will degrade to "not configured".
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly authenticator: any;
  private readonly qrcodeLib: any;

  constructor(
    private prisma: PrismaService,
    private redis: AuthRedis,
    private config: ConfigService,
  ) {
    let auth: any = null;
    let qr: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      auth = require('otplib').authenticator;
      // ±1 window (A8): tolerate clock drift of one 30s step
      auth.options = { window: 1 };
    } catch (e) {
      this.logger.warn(`otplib not available: ${(e as Error).message}`);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      qr = require('qrcode');
    } catch (e) {
      this.logger.warn(`qrcode not available: ${(e as Error).message}`);
    }
    this.authenticator = auth;
    this.qrcodeLib = qr;
  }

  private requireAdmin(role: string) {
    const r = String(role || '').toUpperCase();
    if (r !== 'ADMIN' && r !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        code: '2FA_ADMIN_ONLY',
        message: 'Two-factor auth is admin-only',
      });
    }
  }

  /** Generate a pending secret + provisioning URI (does not persist to DB). */
  async setup(userId: string, role: string) {
    this.requireAdmin(role);
    if (!this.authenticator) {
      throw new BadRequestException({ code: '2FA_NOT_CONFIGURED' });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true, totpEnabled: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) {
      throw new BadRequestException({ code: '2FA_ALREADY_ENABLED' });
    }

    const secret = this.authenticator.generateSecret();
    const issuer = this.config.get<string>('TOTP_ISSUER') || 'SocietyOS';
    const label = user.email || user.phone;
    const otpauth = this.authenticator.keyuri(label, issuer, secret);

    // Store pending secret for 10 minutes (A9)
    await this.redis.set(`2fa:pending:${userId}`, secret, 10 * 60);

    let qrDataUrl: string | undefined;
    if (this.qrcodeLib) {
      try {
        qrDataUrl = await this.qrcodeLib.toDataURL(otpauth);
      } catch (e) {
        this.logger.warn(`qrcode generation failed: ${(e as Error).message}`);
      }
    }

    return { otpauthUrl: otpauth, qrDataUrl, expiresInSeconds: 600 };
  }

  /** Confirm a 6-digit TOTP code; if valid, persist secret + mark enabled. */
  async verifySetup(userId: string, role: string, code: string) {
    this.requireAdmin(role);
    if (!this.authenticator) {
      throw new BadRequestException({ code: '2FA_NOT_CONFIGURED' });
    }
    const secret = await this.redis.get(`2fa:pending:${userId}`);
    if (!secret) {
      throw new BadRequestException({ code: '2FA_SETUP_EXPIRED' });
    }
    const ok = this.authenticator.verify({ token: code, secret });
    if (!ok) {
      throw new UnauthorizedException({ code: '2FA_INVALID_CODE' });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: Buffer.from(secret, 'utf-8'),
        totpEnabled: true,
      },
    });
    await this.redis.del(`2fa:pending:${userId}`);
    return { enabled: true };
  }

  /** Verify a TOTP for a user already enabled — used by /auth/login for admins. */
  async verifyForLogin(userId: string, code: string): Promise<boolean> {
    if (!this.authenticator) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true, role: true },
    });
    if (!user || !user.totpEnabled || !user.totpSecret) return false;
    const secret = Buffer.from(user.totpSecret).toString('utf-8');
    return this.authenticator.verify({ token: code, secret });
  }

  /** Disable 2FA after re-auth (caller verifies recent password/OTP). */
  async disable(userId: string, role: string, code: string) {
    this.requireAdmin(role);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      return { disabled: true };
    }
    const secret = Buffer.from(user.totpSecret).toString('utf-8');
    if (!this.authenticator?.verify({ token: code, secret })) {
      throw new UnauthorizedException({ code: '2FA_INVALID_CODE' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });
    return { disabled: true };
  }

  isAdminRole(role: string | UserRole): boolean {
    const r = String(role || '').toUpperCase();
    return r === 'ADMIN' || r === 'SUPER_ADMIN';
  }
}
