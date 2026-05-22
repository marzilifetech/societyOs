import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { MarziAuthClient } from './marzi-auth.client';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { JwtCoreModule } from '../../common/auth/jwt-core.module';
import { ComplianceModule } from '../compliance/compliance.module';

/**
 * Throttler is configured with explicit OTP/2FA endpoint limits via the
 * @Throttle decorator on routes (P1 wires the global guard). Endpoints that
 * should NOT be subject to global throttling (e.g. /auth/2fa/setup) can be
 * excluded with @SkipThrottle in the future once P1 attaches the guard.
 */
@Module({
  imports: [
    ComplianceModule,
    HttpModule, // outbound HTTP for MarziAuthClient (external OTP delegation)
    JwtCoreModule, // provides PassportModule + JwtStrategy + AuthRedis
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 10, name: 'otp' }, // 10/min/phone-or-IP for OTP routes
      { ttl: 60_000, limit: 100, name: 'default' },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, MarziAuthClient, TokenService, TotpService],
  // Re-export JwtCoreModule so external importers (e.g. TranslateModule)
  // still get AuthRedis transitively.
  exports: [AuthService, TokenService, TotpService, JwtCoreModule],
})
export class AuthModule {}
