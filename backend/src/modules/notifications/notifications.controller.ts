import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { PreferencesService } from './preferences.service';
import { InboxService } from './inbox.service';
import { InboxListQueryDto, RegisterDeviceDto, UpdatePreferencesDto } from './dto/notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationAudience } from '../../common/notification/notification-categories';

/** Maps a user role to the audience used by the notification category registry. */
function roleToAudience(role: string): NotificationAudience {
  switch (role) {
    case 'STAFF':
      return 'staff';
    case 'ADMIN':
    case 'BUILDING_ADMIN':
    case 'SUPER_ADMIN':
      return 'admin';
    case 'RESIDENT':
    default:
      return 'resident';
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private devices: DevicesService,
    private preferences: PreferencesService,
    private inbox: InboxService,
  ) {}

  @Post('devices')
  registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.devices.registerDevice(user.sub, dto);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: JwtPayload) {
    return this.devices.listDevices(user.sub);
  }

  @Delete('devices/:token')
  removeDevice(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.devices.removeDevice(user.sub, token);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.preferences.getPreferences(user.sub, roleToAudience(user.role));
  }

  @Patch('preferences')
  setPreferences(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    return this.preferences.setPreferences(user.sub, roleToAudience(user.role), dto.prefs);
  }

  /** Server-backed inbox — last 20 notifications for the current user. */
  @Get()
  listInbox(@CurrentUser() user: JwtPayload, @Query() query: InboxListQueryDto) {
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.inbox.list(user.sub, { cursor: query.cursor, limit });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.inbox.unreadCount(user.sub);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inbox.markRead(user.sub, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.inbox.markAllRead(user.sub);
  }
}
