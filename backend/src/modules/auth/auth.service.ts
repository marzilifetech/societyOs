import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AuthRedis } from './redis.client';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { normalizeIndianPhone } from '../../common/utils/phone';
import { ComplianceService } from '../compliance/compliance.service';

const ADMIN_SESSION_IDLE_SECONDS = 30 * 60; // 30 minutes

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
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const phone = normalizeIndianPhone(dto.phone);
    const society = await this.prisma.society.findUnique({ where: { id: dto.societyId } });
    if (!society) throw new NotFoundException('Society not found');

    await this.otp.sendOtp(phone);
    return { message: 'OTP sent' };
  }

  async verifyOtp(dto: VerifyOtpDto, totpCode?: string) {
    const phone = normalizeIndianPhone(dto.phone);
    const ok = await this.otp.verifyOtp(phone, dto.otp);
    if (!ok) {
      throw new UnauthorizedException({ code: 'INVALID_OTP' });
    }

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
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
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
