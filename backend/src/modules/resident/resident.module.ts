import { Module } from '@nestjs/common';
import { ResidentController } from './resident.controller';
import { DirectoryController } from './directory.controller';
import { ResidentService } from './resident.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ResidentController, DirectoryController],
  providers: [ResidentService],
  exports: [ResidentService],
})
export class ResidentModule {}
