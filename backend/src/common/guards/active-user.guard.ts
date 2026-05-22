import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwtPayload = request.user;
    if (!jwtPayload) return true; // JWT guard will handle unauthenticated

    const user = await this.prisma.user.findUnique({ where: { id: jwtPayload.sub }, select: { status: true } });
    if (!user) return true;

    if (user.status === 'PENDING') {
      throw new ForbiddenException('Account pending approval. Please complete your profile and wait for admin approval.');
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('Account suspended. Please contact society administration.');
    }
    if (user.status === 'REJECTED') {
      throw new ForbiddenException('Account registration was rejected. Please contact society administration.');
    }
    return true;
  }
}
