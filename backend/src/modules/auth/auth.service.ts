import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AuthRedis } from './redis.client';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { UserRole, UserStatus, SocietyStatus } from '@prisma/client';
import { normalizeIndianPhone } from '../../common/utils/phone';
import { ComplianceService } from '../compliance/compliance.service';

const ADMIN_SESSION_IDLE_SECONDS = 30 * 60; // 30 minutes
/**
 * Short-lived re-auth token TTL. Used by SUPER_ADMIN to authorise a single
 * tenant-switch request (X-Society-Id) after re-confirming identity via
 * TOTP/OTP. One-shot: the jti is consumed on the first verifying middleware
 * read.
 */
const REAUTH_TOKEN_TTL_SECONDS = 5 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private otp: OtpService,
    private tokens: TokenService,
    private totp: TotpService,
    private redis: AuthRedis,
    private compliance: ComplianceService,
    private config: ConfigService,
  ) {}

  /**
   * Issue a one-shot re-auth token. Used exclusively by SUPER_ADMIN to
   * authorise a tenant-switch request — the caller has just re-confirmed
   * identity via TOTP (if enabled) or a fresh OTP. The returned token rides
   * the next request in `X-ReAuth-Token`; the tenant middleware verifies the
   * signature, drops the jti from Redis, and lets the X-Society-Id override
   * through. Reusing the same token a second time fails closed.
   */
  async issueReauthToken(
    userId: string,
    creds: { totpCode?: string; otp?: string; phone?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        totpEnabled: true,
      },
    });
    if (!user) throw new UnauthorizedException({ code: 'USER_REVOKED' });
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED' });
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: 'REAUTH_SUPER_ADMIN_ONLY',
        message: 'Re-auth is reserved for super-admin tenant switching',
      });
    }

    if (user.totpEnabled) {
      if (!creds.totpCode) {
        throw new BadRequestException({
          code: 'REAUTH_TOTP_REQUIRED',
          message: 'TOTP code required for re-authentication',
        });
      }
      const ok = await this.totp.verifyForLogin(user.id, creds.totpCode);
      if (!ok) {
        throw new UnauthorizedException({ code: '2FA_INVALID_CODE' });
      }
    } else {
      // TOTP not enabled — require a fresh OTP delivered to the user's phone.
      if (!creds.otp) {
        throw new BadRequestException({
          code: 'REAUTH_OTP_REQUIRED',
          message: 'OTP required for re-authentication',
        });
      }
      const ok = await this.otp.verifyOtp(user.phone, creds.otp);
      if (!ok) {
        throw new UnauthorizedException({ code: 'INVALID_OTP' });
      }
    }

    const jti = randomUUID();
    const token = this.jwt.sign(
      { sub: user.id, typ: 'reauth', purpose: 'tenant-switch', jti },
      {
        expiresIn: REAUTH_TOKEN_TTL_SECONDS,
        secret: this.config.get('JWT_SECRET'),
      },
    );
    await this.redis.set(`reauth:${jti}`, user.id, REAUTH_TOKEN_TTL_SECONDS);
    return { reauthToken: token, expiresInSeconds: REAUTH_TOKEN_TTL_SECONDS };
  }

  /**
   * Verify + consume a re-auth token. Called by the tenant middleware on a
   * SUPER_ADMIN tenant-switch request. One-shot semantics — the Redis-side
   * jti is deleted after a successful read so the token cannot be replayed.
   */
  async consumeReauthToken(token: string): Promise<{ userId: string } | null> {
    let payload: any;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch {
      return null;
    }
    if (
      !payload ||
      payload.typ !== 'reauth' ||
      payload.purpose !== 'tenant-switch' ||
      !payload.jti ||
      !payload.sub
    ) {
      return null;
    }
    const stored = await this.redis.get(`reauth:${payload.jti}`);
    if (!stored) return null;
    await this.redis.del(`reauth:${payload.jti}`);
    return { userId: payload.sub };
  }

  async sendOtp(dto: SendOtpDto) {
    const phone = normalizeIndianPhone(dto.phone);
    const society = await this.prisma.society.findUnique({ where: { id: dto.societyId } });
    if (!society) throw new NotFoundException('Society not found');
    this.assertSocietyAccessible(society.status, society.id);

    await this.otp.sendOtp(phone);
    return { message: 'OTP sent' };
  }

  /**
   * Reject auth flow when the tenant society is not accepting logins.
   * Throws SOCIETY_SUSPENDED / SOCIETY_ARCHIVED — both surface a clear,
   * non-OTP-confusing reason to the client so it can show the right copy.
   */
  private assertSocietyAccessible(status: SocietyStatus, societyId: string) {
    if (status === SocietyStatus.ACTIVE) return;
    const code = status === SocietyStatus.SUSPENDED ? 'SOCIETY_SUSPENDED' : 'SOCIETY_ARCHIVED';
    this.logger.warn(`Login attempt blocked: society=${societyId} status=${status}`);
    throw new UnauthorizedException({ code });
  }

  async verifyOtp(dto: VerifyOtpDto, totpCode?: string) {
    const phone = normalizeIndianPhone(dto.phone);
    const ok = await this.otp.verifyOtp(phone, dto.otp);
    if (!ok) {
      throw new UnauthorizedException({ code: 'INVALID_OTP' });
    }

    // Re-check society status in case it changed between sendOtp and verifyOtp
    // (e.g. SUPER_ADMIN suspended the society while OTP was in flight).
    const society = await this.prisma.society.findUnique({
      where: { id: dto.societyId },
      select: { id: true, status: true },
    });
    if (!society) throw new NotFoundException('Society not found');
    this.assertSocietyAccessible(society.status, society.id);

    let user = await this.prisma.user.findUnique({
      where: { phone_societyId: { phone, societyId: dto.societyId } },
    });

    const isNewUser = !user;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          societyId: dto.societyId,
          role: UserRole.RESIDENT,
          status: UserStatus.PENDING,
        },
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED' });
    }

    // Admin TOTP gate
    if (this.totp.isAdminRole(user.role) && user.totpEnabled) {
      if (!totpCode) {
        return { totpRequired: true, userId: user.id };
      }
      const valid = await this.totp.verifyForLogin(user.id, totpCode);
      if (!valid) {
        throw new UnauthorizedException({ code: '2FA_INVALID_CODE' });
      }
    }

    const pair = await this.tokens.issuePair({
      sub: user.id,
      phone: user.phone,
      role: user.role,
      societyId: user.societyId,
      managedBlocks: (user as any).managedBlocks ?? [],
    });

    await this.bumpActivity(user.id);

    if (user.role === UserRole.RESIDENT) {
      const resident = await this.prisma.resident.findUnique({ where: { userId: user.id } });
      if (resident && !resident.appActivatedAt) {
        await this.prisma.resident.update({
          where: { id: resident.id },
          data: { appActivatedAt: new Date() },
        });
      }
    }

    return {
      // Backwards compat: existing clients read `token`
      token: pair.accessToken,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
        name: user.name,
      },
      isNewUser,
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.decode(refreshToken) as any;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    }
    if (!payload?.sub) throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { society: { select: { status: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    // Refresh must also fail closed if society was suspended/archived
    // mid-session; otherwise the access token would just be rotated forever.
    // SUPER_ADMIN lives in a Platform society which is never suspended, so the
    // same gate applies uniformly. Defensive: if the relation is somehow
    // null (FK orphan / DB inconsistency) treat as USER_REVOKED rather than
    // throwing an NPE that surfaces to the client as a 500.
    if (!user.society) {
      this.logger.warn(`refresh blocked: user ${user.id} has no society relation`);
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    this.assertSocietyAccessible(user.society.status, user.societyId);
    const pair = await this.tokens.rotateRefresh(refreshToken, {
      phone: user.phone,
      role: user.role,
      societyId: user.societyId,
      managedBlocks: (user as any).managedBlocks ?? [],
    });
    await this.bumpActivity(user.id);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, token: pair.accessToken };
  }

  async getMe(userId: string, role?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        name: true,
        email: true,
        societyId: true,
        notificationPrefs: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      // A10
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }

    // Admin idle-session timeout
    if (this.totp.isAdminRole(user.role)) {
      const last = await this.redis.get(`session:last:${userId}`);
      if (last) {
        const ageSec = Math.floor((Date.now() - parseInt(last, 10)) / 1000);
        if (ageSec > ADMIN_SESSION_IDLE_SECONDS) {
          throw new UnauthorizedException({ code: 'SESSION_TIMEOUT' });
        }
      }
    }
    await this.bumpActivity(userId);

    return user;
  }

  async logout(token: string) {
    await this.tokens.revoke(token);
    return { message: 'Logged out' };
  }

  async deleteAccount(userId: string, accessToken?: string) {
    await this.compliance.dataDelete(userId, null);
    if (accessToken) {
      await this.tokens.revoke(accessToken);
    }
    return { message: 'Account deleted', ok: true };
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken } });
    return { message: 'FCM token updated' };
  }

  async registerDeviceToken(userId: string, token: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { deviceToken: token } });
  }

  async updateNotificationPrefs(userId: string, prefs: Record<string, boolean>) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: prefs as any },
    });
    return { message: 'Notification preferences updated' };
  }

  private async bumpActivity(userId: string) {
    try {
      await this.redis.set(`session:last:${userId}`, String(Date.now()), 24 * 3600);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      }).catch(() => null);
    } catch {
      /* noop */
    }
  }
}
