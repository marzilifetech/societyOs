import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsentModule } from '../../common/consent/consent.module';
import { AuditModule } from '../../common/audit/audit.module';
import { ComplianceService } from './compliance.service';
import {
  ComplianceController,
  AdminAuditLogsController,
} from './compliance.controller';

@Module({
  imports: [PrismaModule, ConsentModule, AuditModule],
  controllers: [ComplianceController, AdminAuditLogsController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
