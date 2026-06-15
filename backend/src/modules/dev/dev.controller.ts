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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PushService } from '../../common/notification/push.service';

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
