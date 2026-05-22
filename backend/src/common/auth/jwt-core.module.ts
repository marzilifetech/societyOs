import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import { AuthRedis } from '../../modules/auth/redis.client';

/**
 * JWT verification surface, extracted so both the container's AuthModule
 * and Lambda-side apps can consume the same JwtStrategy + denylist + Redis
 * client without duplicating logic.
 *
 * Does NOT include signing/issuance, OTP, refresh rotation, TOTP, or SMS —
 * those remain in AuthModule (container-only). Verification is the only
 * piece Lambdas need to honor `@UseGuards(JwtAuthGuard)`.
 *
 * Marked @Global so any feature module's @UseGuards(JwtAuthGuard) resolves
 * Passport's 'jwt' strategy without each module re-importing.
 */
@Global()
@Module({
  imports: [ConfigModule, PassportModule],
  providers: [JwtStrategy, AuthRedis],
  exports: [PassportModule, AuthRedis],
})
export class JwtCoreModule {}
