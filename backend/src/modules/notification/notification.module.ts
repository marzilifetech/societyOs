import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushModule } from '../../common/notification/push.module';

@Module({
  imports: [PushModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
