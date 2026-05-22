import { Module } from '@nestjs/common';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';
import { VisitorGateway } from './visitor.gateway';

@Module({
  controllers: [VisitorController],
  providers: [VisitorService, VisitorGateway],
})
export class VisitorModule {}
