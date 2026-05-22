import { Module } from '@nestjs/common';
import { DocumentRequestController } from './document-request.controller';
import { DocumentRequestService } from './document-request.service';

@Module({
  controllers: [DocumentRequestController],
  providers: [DocumentRequestService],
})
export class DocumentRequestModule {}
