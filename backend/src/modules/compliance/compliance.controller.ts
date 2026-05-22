import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  StreamableFile,
  Res,
  Header,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplianceService } from './compliance.service';
import { ConsentService } from '../../common/consent/consent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';

@Controller('compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly consent: ConsentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('consent')
  async acceptConsent(
    @CurrentUser() user: any,
    @Body() body: { accepted: boolean },
    @Req() req: Request,
  ) {
    if (!body?.accepted) {
      return this.consent.revoke(user.sub, req.ip);
    }
    return this.consent.record({
      userId: user.sub,
      action: 'ACCEPTED_PRIVACY',
      societyId: user.societyId,
      ipAddress: req.ip,
    });
  }

  @Get('my-data')
  async myData(@CurrentUser() user: any) {
    return this.compliance.myData(user.sub);
  }

  // C2: 1/hour/user enforced via Throttler ttl 3600s, limit 1
  @Get('data-export')
  @Throttle({ default: { limit: 1, ttl: 3600_000 } })
  async dataExport(@CurrentUser() user: any, @Req() req: Request) {
    return this.compliance.dataExport(user.sub, req.ip);
  }

  @Delete('data-delete')
  @HttpCode(200)
  async dataDelete(@CurrentUser() user: any, @Req() req: Request) {
    return this.compliance.dataDelete(user.sub, req.ip);
  }
}

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as any, 'SUPER_ADMIN' as any)
export class AdminAuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('entity') entity?: string,
    @Query('adminId') adminId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('take') takeStr?: string,
  ) {
    const take = Math.min(parseInt(takeStr ?? '50', 10) || 50, 200);
    const where: any = {};
    if (entity) where.entityType = entity;
    if (adminId) where.actorId = adminId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const items = await (this.prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const slice = hasMore ? items.slice(0, take) : items;
    return {
      items: slice,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  async exportCsv(
    @Res({ passthrough: true }) _res: Response,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StreamableFile> {
    const where: any = {};
    if (entity) where.entityType = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const rows = await (this.prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    const header = 'id,createdAt,entityType,entityId,action,actorId,actorRole,societyId\n';
    const body = rows
      .map((r: any) =>
        [
          r.id,
          r.createdAt.toISOString(),
          r.entityType,
          r.entityId,
          JSON.stringify(r.action),
          r.actorId ?? '',
          r.actorRole ?? '',
          r.societyId ?? '',
        ].join(','),
      )
      .join('\n');
    return new StreamableFile(Buffer.from(header + body, 'utf8'));
  }
}
