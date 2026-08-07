// Maps each Lambda target to its NestJS module set.
// Static imports here are intentional: bundlers (esbuild) tree-shake
// any module not referenced by the chosen handler, keeping cold-start
// bundles small. See /Users/mayankdwivedi/.claude/plans/first-thing-first-bro-stateful-truffle.md §1.
//
// Modules that stay container-only (NOT in any Lambda):
//   RealtimeModule      — Socket.io needs persistent connections
//   NotificationModule  — BullMQ worker process
//
// AuthModule is ALSO deployed inside the core-identity Lambda (per user choice).
// In production the API Gateway routes /auth/* exclusively to the container,
// so the duplicate routes are unreachable — but the AuthService / TokenService
// providers become available for any future core-identity Lambda code that
// needs to issue tokens, look up users, etc. This trades a heavier cold-start
// for DI symmetry between the two deploy targets.

import type { Type } from '@nestjs/common';

import { AdminModule } from '../modules/admin/admin.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FamilyMemberModule } from '../modules/family-member/family-member.module';
import { InfrastructureModule } from '../modules/infrastructure/infrastructure.module';
import { PropertyModule } from '../modules/property/property.module';
import { ResidentModule } from '../modules/resident/resident.module';
import { SocietyModule } from '../modules/society/society.module';
import { StaffModule } from '../modules/staff/staff.module';
import { UploadModule } from '../modules/upload/upload.module';
import { VehicleModule } from '../modules/vehicle/vehicle.module';

import { ComplaintModule } from '../modules/complaint/complaint.module';
import { FeedbackModule } from '../modules/feedback/feedback.module';
import { HelpRequestModule } from '../modules/help-request/help-request.module';
import { ServiceRequestModule } from '../modules/service-request/service-request.module';
import { VendorModule } from '../modules/vendor/vendor.module';

import { AgmModule } from '../modules/agm/agm.module';
import { CanteenModule } from '../modules/canteen/canteen.module';
import { CommunityModule } from '../modules/community/community.module';
import { DocumentRequestModule } from '../modules/document-request/document-request.module';
import { EventModule } from '../modules/event/event.module';
import { NoticeModule } from '../modules/notice/notice.module';
import { StaffCommunityModule } from '../modules/staff-community/staff-community.module';

import { PackageModule } from '../modules/package/package.module';
import { ParkingModule } from '../modules/parking/parking.module';
import { SecurityModule } from '../modules/security/security.module';
import { SosModule } from '../modules/sos/sos.module';
import { VisitorModule } from '../modules/visitor/visitor.module';

import { MaintenanceModule } from '../modules/maintenance/maintenance.module';
import { SubscriptionModule } from '../modules/subscription/subscription.module';
import { WalletModule } from '../modules/wallet/wallet.module';

import { AmenityModule } from '../modules/amenity/amenity.module';
import { ConciergeModule } from '../modules/concierge/concierge.module';
import { DomesticHelpModule } from '../modules/domestic-help/domestic-help.module';
import { HousekeepingModule } from '../modules/housekeeping/housekeeping.module';
import { LaundryModule } from '../modules/laundry/laundry.module';
import { PestControlModule } from '../modules/pest-control/pest-control.module';
import { TravelPauseModule } from '../modules/travel-request/travel-pause.module';

import { ComplianceModule } from '../modules/compliance/compliance.module';
import { MedicalModule } from '../modules/medical/medical.module';
// Resident health features (vitals/medications/records). Aliased to avoid the
// name clash with the infra liveness HealthModule already imported in
// create-lambda-app. Belongs in the 'health-medical' group below.
import { HealthModule as ResidentHealthModule } from '../modules/health/health.module';

export type LambdaName =
  | 'core-identity'
  | 'service-ops'
  | 'community-social'
  | 'security-gate'
  | 'payments'
  | 'payments-webhook'
  | 'home-services'
  | 'health-medical';

export const MODULE_GROUPS: Record<LambdaName, Type<unknown>[]> = {
  'core-identity': [
    AuthModule, // duplicated here per user choice; /auth/* routed to container in prod
    SocietyModule,
    ResidentModule,
    StaffModule,
    AdminModule,
    FamilyMemberModule,
    PropertyModule,
    InfrastructureModule,
    VehicleModule,
    UploadModule,
  ],
  'service-ops': [
    ServiceRequestModule,
    ComplaintModule,
    HelpRequestModule,
    FeedbackModule,
    VendorModule,
  ],
  'community-social': [
    CommunityModule,
    StaffCommunityModule,
    NoticeModule,
    EventModule,
    AgmModule,
    DocumentRequestModule,
    CanteenModule,
  ],
  'security-gate': [
    VisitorModule,
    SosModule,
    PackageModule,
    ParkingModule,
    SecurityModule,
  ],
  // Razorpay create-order, payment status reads, ledger, subscriptions.
  // Webhook is split into its own Lambda (raw-body + provisioned concurrency).
  payments: [MaintenanceModule, WalletModule, SubscriptionModule],
  // Webhook-only deploy. API Gateway routes /webhooks/razorpay → this Lambda;
  // it shares MaintenanceModule but only the webhook route is reachable in prod
  // (gated at the API Gateway layer, not in code).
  'payments-webhook': [MaintenanceModule],
  'home-services': [
    HousekeepingModule,
    LaundryModule,
    PestControlModule,
    DomesticHelpModule,
    ConciergeModule,
    AmenityModule,
    TravelPauseModule,
  ],
  'health-medical': [MedicalModule, ResidentHealthModule, ComplianceModule],
};
