import { Module } from '@nestjs/common';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';
import { VisitorGateway } from './visitor.gateway';
import { PushModule } from '../../common/notification/push.module';

@Module({
  imports: [PushModule],
  controllers: [VisitorController],
  providers: [VisitorService, VisitorGateway],
  exports: [VisitorService],
})
export class VisitorModule {}
