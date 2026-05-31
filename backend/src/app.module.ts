import { existsSync } from 'fs';
import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SocietyModule } from './modules/society/society.module';
import { ResidentModule } from './modules/resident/resident.module';
import { StaffModule } from './modules/staff/staff.module';
import { VisitorModule } from './modules/visitor/visitor.module';
import { ServiceRequestModule } from './modules/service-request/service-request.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { CanteenModule } from './modules/canteen/canteen.module';
import { EventModule } from './modules/event/event.module';
import { MedicalModule } from './modules/medical/medical.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { NoticeModule } from './modules/notice/notice.module';
import { SosModule } from './modules/sos/sos.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { StaffCommunityModule } from './modules/staff-community/staff-community.module';
import { HelpRequestModule } from './modules/help-request/help-request.module';
import { TravelPauseModule } from './modules/travel-request/travel-pause.module';
import { ConciergeModule } from './modules/concierge/concierge.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LaundryModule } from './modules/laundry/laundry.module';
import { SecurityModule } from './modules/security/security.module';
import { StorageModule } from './common/storage/storage.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { AgmModule } from './modules/agm/agm.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PackageModule } from './modules/package/package.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { PestControlModule } from './modules/pest-control/pest-control.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { PropertyModule } from './modules/property/property.module';
import { AmenityModule } from './modules/amenity/amenity.module';
import { CommunityModule } from './modules/community/community.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DocumentRequestModule } from './modules/document-request/document-request.module';
import { DomesticHelpModule } from './modules/domestic-help/domestic-help.module';
import { FamilyMemberModule } from './modules/family-member/family-member.module';
import { ParkingModule } from './modules/parking/parking.module';
import { UploadModule } from './modules/upload/upload.module';
import { MediaModule } from './modules/media/media.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';

import { envValidationSchema } from './common/config/env.validation';
import { AppLoggerModule } from './common/logging/logger.module';
import { HealthModule } from './common/health/health.module';
import {
  AppThrottlerGuard,
  throttlerOptions,
} from './common/config/throttler.config';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ShutdownGuardMiddleware } from './common/middleware/shutdown.middleware';

// --- Optional P2/P3 module wiring (best-effort) ---
// Imports modules only when their entry files exist so partial checkouts still boot.
const optionalModules: any[] = [];

function tryAdd(rel: string, namedExport: string) {
  const abs = join(__dirname, rel);
  if (existsSync(abs + '.ts') || existsSync(abs + '.js')) {
    try {

      const mod = require(rel);
      if (mod[namedExport]) optionalModules.push(mod[namedExport]);
    } catch {
      /* ignore missing peer deps at import-time */
    }
  }
}

// P2 owners
tryAdd('./common/notification/push.module', 'PushModule');
tryAdd('./modules/translate/translate.module', 'TranslateModule');
// EventsGateway is provided via RealtimeModule by P2; if a separate events.module appears, pick it up.
tryAdd('./common/realtime/events.module', 'EventsModule');

// P3 owners
tryAdd('./common/tenancy/tenancy.module', 'TenancyModule');
tryAdd('./common/audit/audit.module', 'AuditModule');
tryAdd('./common/encryption/encryption.module', 'EncryptionModule');
tryAdd('./modules/compliance/compliance.module', 'ComplianceModule');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    AppLoggerModule,
    ThrottlerModule.forRootAsync(throttlerOptions),
    PrismaModule,
    StorageModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    SocietyModule,
    ResidentModule,
    StaffModule,
    VisitorModule,
    ServiceRequestModule,
    ComplaintModule,
    CanteenModule,
    EventModule,
    MedicalModule,
    MaintenanceModule,
    NoticeModule,
    SosModule,
    NotificationModule,
    AdminModule,
    StaffCommunityModule,
    HelpRequestModule,
    TravelPauseModule,
    ConciergeModule,
    LaundryModule,
    SecurityModule,
    WalletModule,
    AgmModule,
    InfrastructureModule,
    FeedbackModule,
    SubscriptionModule,
    PackageModule,
    HousekeepingModule,
    PestControlModule,
    VendorModule,
    PropertyModule,
    AmenityModule,
    CommunityModule,
    ComplianceModule,
    DocumentRequestModule,
    DomesticHelpModule,
    FamilyMemberModule,
    ParkingModule,
    UploadModule,
    MediaModule,
    VehicleModule,
    ...optionalModules,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, ShutdownGuardMiddleware).forRoutes('*');
  }
}
