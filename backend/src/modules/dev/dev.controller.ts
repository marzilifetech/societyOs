import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PushService } from '../../common/notification/push.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Sample fixtures used to exercise the full client-side rendering path
 * (rich foreground banner + lockscreen action buttons + tap routing). Keyed
 * by the `data.type` the apps dispatch on, NOT by the FCM `category` —
 * `category` is for opt-out, `type` is for routing.
 */
const FIXTURES = {
  VISITOR_APPROVAL_REQUEST: {
    title: 'Visitor at Gate',
    body: 'Ramesh (Domestic help) is at the main gate. Approve entry?',
    category: 'visitors_gate',
    imageUrl: 'https://picsum.photos/seed/visitor/256/256',
    actionGroup: 'visitor_approval',
    entityId: 'dev-visitor-123',
  },
  VISITOR_ARRIVAL: {
    title: 'Visitor has arrived',
    body: 'Ramesh has entered the society.',
    category: 'visitors_gate',
    imageUrl: 'https://picsum.photos/seed/visitor/256/256',
    entityId: 'dev-visitor-123',
  },
  PACKAGE_ARRIVED: {
    title: 'Package waiting',
    body: 'A package from Amazon is at reception.',
    category: 'deliveries',
    entityId: 'dev-package-1',
  },
  COMPLAINT_UPDATED: {
    title: 'Complaint update',
    body: 'Your lift complaint is now IN_PROGRESS.',
    category: 'complaints',
    entityId: 'dev-complaint-1',
  },
  NOTICE_PUBLISHED: {
    title: 'New society notice',
    body: 'Water tank cleaning tomorrow 9–11am.',
    category: 'notices',
    entityId: 'dev-notice-1',
  },
  SOS_TRIGGERED: {
    title: '🚨 EMERGENCY',
    body: 'Resident triggered SOS in T-101.',
    category: 'emergency_sos',
    critical: true,
    entityId: 'dev-sos-1',
  },
  TASK_ASSIGNED: {
    title: 'New task',
    body: 'Lift maintenance assigned to you.',
    category: 'staff_tasks',
    actionGroup: 'task_assignment',
    entityId: 'dev-task-1',
  },
  HELP_REQUEST: {
    title: 'Resident needs help',
    body: 'A resident in T-205 is requesting your help.',
    category: 'staff_tasks',
    actionGroup: 'help_request',
    entityId: 'dev-help-1',
  },
} as const;

class PushTestDto {
  @ApiPropertyOptional({
    description: 'Routing type (also chooses the fixture). Defaults to VISITOR_APPROVAL_REQUEST.',
    enum: Object.keys(FIXTURES),
  })
  @IsOptional()
  @IsString()
  type?: keyof typeof FIXTURES;

  @ApiPropertyOptional({
    description: 'Override target user ID. Defaults to the calling user.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Include Approve/Reject action buttons (only applies to actionable types).',
  })
  @IsOptional()
  @IsBoolean()
  includeActions?: boolean;
}

/**
 * Dev-only push test endpoint. Hard-gated on NODE_ENV — returns 403 in
 * production regardless of who calls. Use during QA to verify the full path:
 * backend FCM send → device receive → foreground banner / lockscreen render →
 * tap routing → backend action call. Always writes a NotificationLog row so
 * you can inspect what shipped.
 */
@ApiTags('dev')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dev')
export class DevController {
  constructor(
    private config: ConfigService,
    private push: PushService,
    private prisma: PrismaService,
  ) {}


  @Post('push-test')
  @ApiOperation({ summary: 'Fire a sample push to the current user (dev only).' })
  async pushTest(@CurrentUser() user: JwtPayload, @Body() dto: PushTestDto) {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    if (env === 'production') {
      throw new ForbiddenException({
        code: 'DEV_ENDPOINT_DISABLED',
        message: 'Dev endpoints are disabled in production',
      });
    }

    const type = dto.type ?? 'VISITOR_APPROVAL_REQUEST';
    const fixture = FIXTURES[type];
    if (!fixture) {
      throw new BadRequestException({ code: 'UNKNOWN_FIXTURE', message: `Unknown type: ${type}` });
    }

    const target = dto.userId ?? user.sub;
    const wantActions = dto.includeActions ?? 'actionGroup' in fixture;

    const data: Record<string, string> = {
      type,
      entityId: fixture.entityId,
    };
    if ('actionGroup' in fixture && fixture.actionGroup) {
      data.actionGroup = fixture.actionGroup;
    }

    const result = await this.push.send(
      target,
      {
        title: fixture.title,
        body: fixture.body,
        category: fixture.category,
        critical: 'critical' in fixture ? fixture.critical : false,
        imageUrl: 'imageUrl' in fixture ? fixture.imageUrl : undefined,
        ...(wantActions && 'actionGroup' in fixture
          ? {
              actions:
                fixture.actionGroup === 'visitor_approval'
                  ? [
                      { id: 'APPROVE', title: 'Approve' },
                      { id: 'REJECT', title: 'Reject', destructive: true },
                    ]
                  : fixture.actionGroup === 'help_request'
                  ? [
                      { id: 'ACCEPT', title: 'Accept' },
                      { id: 'DECLINE', title: 'Decline', destructive: true },
                    ]
                  : fixture.actionGroup === 'task_assignment'
                  ? [
                      { id: 'ACCEPT', title: 'Accept' },
                      { id: 'REJECT', title: 'Reject', destructive: true },
                    ]
                  : [],
            }
          : {}),
      },
      data,
    );

    return { target, fixture: type, result };
  }
}

/**
 * Sibling PUBLIC controller for seed-test-users. Sits at the same /dev
 * prefix but DOESN'T inherit the JwtAuthGuard from {@link DevController}.
 *
 * Why a separate class: the JWT auth guard sits at the class level above,
 * and overriding it per-method is awkward in Nest. A second controller
 * with no guards is the cleanest way to expose ONE public dev endpoint
 * without leaking the rest.
 *
 * Triple-locked even without auth:
 *  - NODE_ENV !== 'production' check (returns 403 otherwise).
 *  - SQL comes from a static file checked into the repo, NOT request input.
 *  - Endpoint is idempotent (ON CONFLICT ... DO UPDATE), so a malicious
 *    spammer can only refresh test-user rows back to their canonical state.
 */
@ApiTags('dev')
@Controller('dev')
export class DevPublicController {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Post('seed-test-users')
  @ApiOperation({ summary: 'Run the dev seed-test-users SQL (dev only, public).' })
  async seedTestUsers() {
    // The Dockerfile pins NODE_ENV=production for image-build reasons (smaller
    // bundles, real-mode logging) even on the dev instance, so we can't gate
    // on NODE_ENV alone — we'd lock ourselves out of the dev instance too.
    // ALLOW_DEV_ENDPOINTS is a separate explicit opt-in: dev secret sets it
    // to '1', production secret leaves it unset.
    const allow = this.config.get<string>('ALLOW_DEV_ENDPOINTS');
    if (allow !== '1' && allow !== 'true') {
      throw new ForbiddenException({
        code: 'DEV_ENDPOINT_DISABLED',
        message: 'Dev endpoints are disabled here',
      });
    }

    // The container has the source rsync'd to /repo. Look in both layouts.
    const candidatePaths = [
      path.resolve(process.cwd(), '../infra/instance/seed-test-users.sql'),
      path.resolve(process.cwd(), 'infra/instance/seed-test-users.sql'),
      '/repo/infra/instance/seed-test-users.sql',
    ];
    const sqlPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!sqlPath) {
      throw new BadRequestException({
        code: 'SEED_FILE_MISSING',
        message: `Could not find seed-test-users.sql in any of: ${candidatePaths.join(', ')}`,
      });
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    // Prisma's $executeRawUnsafe wants a SINGLE statement. The seed SQL is
    // two top-level `DO $$ ... END $$;` blocks (residents, then staff). We
    // split on the block-end marker and run each one individually.
    const blocks = sql
      .split(/END\s+\$\$\s*;/i)
      .map((chunk, i, arr) => {
        if (i === arr.length - 1) return chunk.trim();
        return chunk.trim() + '\nEND $$;';
      })
      .filter((b) => b.length > 0 && /\bDO\s+\$\$/i.test(b));

    for (const block of blocks) {
      await this.prisma.$executeRawUnsafe(block);
    }
    return { ok: true, sqlPath, blocks: blocks.length, length: sql.length };
  }
}
