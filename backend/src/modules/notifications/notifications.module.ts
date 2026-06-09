import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DevicesService } from './devices.service';
import { PreferencesService } from './preferences.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [DevicesService, PreferencesService],
  exports: [DevicesService, PreferencesService],
})
export class NotificationsModule {}
