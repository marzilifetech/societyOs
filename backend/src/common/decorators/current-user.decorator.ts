import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  /**
   * True when this user occupies a flat, derived per request from the Resident
   * row (see JwtStrategy.validate) rather than from `role`.
   *
   * `role` holds ONE value, so promoting a resident to society admin overwrites
   * RESIDENT and would otherwise revoke their access to every resident route —
   * and committee members are almost always residents. Personalising branches
   * ("show me MY bookings") must key on this, not on `role`.
   */
  isResident?: boolean;
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
