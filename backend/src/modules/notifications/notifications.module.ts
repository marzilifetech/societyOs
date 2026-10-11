import { DeviceReleaseController } from './device-release.controller';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DevicesService } from './devices.service';
import { PreferencesService } from './preferences.service';
import { InboxService } from './inbox.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, DeviceReleaseController],
  providers: [DevicesService, PreferencesService, InboxService],
  exports: [DevicesService, PreferencesService, InboxService],
})
export class NotificationsModule {}
