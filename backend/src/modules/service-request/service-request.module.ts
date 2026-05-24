import { Module } from '@nestjs/common';
import { ServiceRequestController } from './service-request.controller';
import { ServiceRequestService } from './service-request.service';
import { ServiceRequestGateway } from './service-request.gateway';
import { ServiceRequestReminderScheduler } from './service-request-reminder.scheduler';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [StorageModule, NotificationModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService, ServiceRequestGateway, ServiceRequestReminderScheduler],
  exports: [ServiceRequestService],
})
export class ServiceRequestModule {}
