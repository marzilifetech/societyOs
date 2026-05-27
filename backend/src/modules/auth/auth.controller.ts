import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Get,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LocalOtpEnabledGuard } from '../../common/guards/local-otp-enabled.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsString, IsObject, IsOptional, Length } from 'class-validator';

class FcmTokenDto {
  @ApiProperty()
  @IsString()
  fcmToken: string;
}

class NotificationPrefsDto {
  @ApiProperty()
  @IsObject()
  prefs: Record<string, boolean>;
}

class VerifyOtpWithTotpDto extends VerifyOtpDto {
  @ApiPropertyOptional({ description: '6-digit TOTP code (admin-only, when 2FA enabled)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

class TotpCodeDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code: string;
}

class ReauthDto {
  @ApiPropertyOptional({ description: '6-digit TOTP code (required if 2FA enabled)' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;

  @ApiPropertyOptional({ description: 'Fresh OTP code (used when 2FA is not enabled)' })
  @IsOptional()
  @IsString()
  otp?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private totp: TotpService,
  ) {}

  // OTP routes delegate to external Marzi Senior Community backend in prod.
  // LocalOtpEnabledGuard returns 404 unless AUTH_LOCAL_OTP_ENABLED=true.
  @Post('send-otp')
  @UseGuards(LocalOtpEnabledGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @UseGuards(LocalOtpEnabledGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyOtp(@Body() dto: VerifyOtpWithTotpDto) {
    return this.authService.verifyOtp(dto, dto.totpCode);
  }

  /**
   * Refresh tokens. Accepts {refreshToken} in body (preferred). Falls back to
   * legacy bearer-only refresh for backwards compat: extracts refresh from
   * Authorization header — kept to avoid breaking any old clients.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Body() dto: RefreshDto, @Headers('authorization') auth?: string) {
    const rt = dto?.refreshToken || (auth || '').replace(/^Bearer\s+/, '');
    return this.authService.refreshToken(rt);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub, user.role);
  }

  /**
   * Re-authenticate a SUPER_ADMIN before performing a tenant-switch. The
   * caller is already holding a valid access token; this endpoint upgrades
   * that session with a short-lived, one-shot `X-ReAuth-Token` that the
   * tenant middleware will consume on the very next request that carries
   * `X-Society-Id`.
   */
  @Post('reauth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  reauth(@CurrentUser() user: JwtPayload, @Body() dto: ReauthDto) {
    return this.authService.issueReauthToken(user.sub, {
      totpCode: dto.totpCode,
      otp: dto.otp,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  logout(@Headers('authorization') auth?: string) {
    const token = (auth || '').replace(/^Bearer\s+/, '');
    return this.authService.logout(token);
  }

  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deleteAccount(@CurrentUser() user: JwtPayload, @Headers('authorization') auth?: string) {
    const token = (auth || '').replace(/^Bearer\s+/i, '');
    return this.authService.deleteAccount(user.sub, token);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  totpSetup(@CurrentUser() user: JwtPayload) {
    return this.totp.setup(user.sub, user.role);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  totpVerify(@CurrentUser() user: JwtPayload, @Body() dto: TotpCodeDto) {
    return this.totp.verifySetup(user.sub, user.role, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  totpDisable(@CurrentUser() user: JwtPayload, @Body() dto: TotpCodeDto) {
    return this.totp.disable(user.sub, user.role, dto.code);
  }

  @Patch('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateFcmToken(@CurrentUser() user: JwtPayload, @Body() dto: FcmTokenDto) {
    return this.authService.updateFcmToken(user.sub, dto.fcmToken);
  }

  @Patch('notification-prefs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateNotificationPrefs(@CurrentUser() user: JwtPayload, @Body() dto: NotificationPrefsDto) {
    return this.authService.updateNotificationPrefs(user.sub, dto.prefs);
  }

  @Post('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  registerDeviceToken(@CurrentUser() user: JwtPayload, @Body('token') token: string) {
    return this.authService.registerDeviceToken(user.sub, token);
  }
}
