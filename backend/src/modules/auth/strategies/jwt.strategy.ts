import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { AuthRedis } from '../redis.client';
import { UserStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private redis: AuthRedis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
      // Allow tiny clock skew (60s) — outside this window we surface TOKEN_SKEW.
      clockTolerance: 60,
    });
  }

  async validate(payload: JwtPayload & { jti?: string }) {
    if (payload.jti) {
      const denied = await this.redis.get(`denylist:${payload.jti}`);
      if (denied) {
        throw new UnauthorizedException({ code: 'TOKEN_REVOKED' });
      }
    }
    // External Marzi backend issues `tid` (tenant UUID); map to societyId.
    // Locally-issued tokens already carry societyId — leave them untouched.
    if (!payload.societyId && payload.tid) {
      payload.societyId = payload.tid;
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      // TODO (Phase 2): when payload has external claims (tid/tenant_name),
      // sync from external `/v1/users/me` and create local mirror. For now
      // require provisioning to have happened upstream.
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    return payload;
  }
}
