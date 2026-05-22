import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  societyId: string;
  managedBlocks?: string[];
  // External Marzi Senior Community backend issues these claims; mirrored into
  // societyId by JwtStrategy when present. `tenant_name` is informational.
  tid?: string;
  tenant_name?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
