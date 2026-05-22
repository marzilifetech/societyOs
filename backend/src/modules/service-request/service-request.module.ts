import { Module } from '@nestjs/common';
import { ServiceRequestController } from './service-request.controller';
import { ServiceRequestService } from './service-request.service';
import { ServiceRequestGateway } from './service-request.gateway';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService, ServiceRequestGateway],
})
export class ServiceRequestModule {}
