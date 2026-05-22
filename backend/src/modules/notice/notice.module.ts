import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller';
import { NoticeService } from './notice.service';
import { RealtimeModule } from '../../common/realtime/realtime.module';
import { PushModule } from '../../common/notification/push.module';

@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [NoticeController],
  providers: [NoticeService],
})
export class NoticeModule {}
