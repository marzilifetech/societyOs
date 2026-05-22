import { Module } from '@nestjs/common';
import { ComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';
import { ComplaintGateway } from './complaint.gateway';

@Module({
  controllers: [ComplaintController],
  providers: [ComplaintService, ComplaintGateway],
})
export class ComplaintModule {}
