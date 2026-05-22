import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { tenantStorage, TenantContext } from './tenant.context';

/**
 * TenantMiddleware
 *
 * Extracts tenant context (societyId, userId, role) from the bearer JWT
 * and stores it into AsyncLocalStorage so the Prisma tenant extension
 * can scope every query.
 *
 * Corner case MT4: Super-admins may switch tenant via `X-Society-Id`
 * header — this requires `X-ReAuth-Confirmed: 1` to be set. Mismatch
 * returns 400 BadRequest.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwt?: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const ctx: TenantContext = {
      societyId: null,
      userId: null,
      role: null,
      superAdminBypass: false,
      reAuthConfirmed: req.header('x-reauth-confirmed') === '1',
      requestId: (req.headers['x-request-id'] as string) || undefined,
    };

    const auth = req.header('authorization');
    if (auth?.startsWith('Bearer ') && this.jwt) {
      try {
        const token = auth.slice(7);
        const payload: any = this.jwt.decode(token);
        if (payload && typeof payload === 'object') {
          ctx.userId = payload.sub ?? null;
          ctx.role = payload.role ?? null;
          ctx.societyId = payload.societyId ?? null;
        }
      } catch {
        // ignore — auth guard will reject
      }
    }

    // Super-admin tenant override
    const switchHeader = req.header('x-society-id');
    if (switchHeader && ctx.role === 'SUPER_ADMIN') {
      if (!ctx.reAuthConfirmed) {
        throw new BadRequestException({
          code: 'REAUTH_REQUIRED',
          message: 'Super-admin tenant switch requires X-ReAuth-Confirmed: 1',
        });
      }
      ctx.societyId = switchHeader;
      ctx.superAdminBypass = true;
    }

    tenantStorage.run(ctx, () => next());
  }
}
