import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { AuditModule } from '../../common/audit/audit.module';
import { ServiceRequestModule } from '../service-request/service-request.module';

@Module({
  imports: [PrismaModule, NotificationModule, ComplianceModule, AuditModule, ServiceRequestModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
