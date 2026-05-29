import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { AuthRedis } from '../redis.client';
import { UserStatus, SocietyStatus, UserRole } from '@prisma/client';

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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { society: { select: { id: true, status: true } } },
    });
    if (!user) {
      // TODO (Phase 2): when payload has external claims (tid/tenant_name),
      // sync from external `/v1/users/me` and create local mirror. For now
      // require provisioning to have happened upstream.
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    // FK-orphan defence: a stale token may reference a deleted/missing society.
    // Mirrors the null-society guard in AuthService.refreshToken — surface
    // USER_REVOKED so the client can re-auth cleanly instead of throwing
    // "Cannot read properties of undefined".
    if (!user.society) {
      throw new UnauthorizedException({ code: 'USER_REVOKED' });
    }
    // Society lifecycle gate: SUSPENDED/ARCHIVED home society = no further access.
    // SUPER_ADMIN is exempted only because their home society is the Platform
    // society which is enforced to be ACTIVE — they never get here otherwise.
    if (user.role !== UserRole.SUPER_ADMIN && user.society.status !== SocietyStatus.ACTIVE) {
      const code = user.society.status === SocietyStatus.SUSPENDED ? 'SOCIETY_SUSPENDED' : 'SOCIETY_ARCHIVED';
      throw new UnauthorizedException({ code });
    }
    return payload;
  }
}
