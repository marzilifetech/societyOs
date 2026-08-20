import { Global, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAccessService } from './admin-access.service';
import { AdminAccessController } from './admin-access.controller';

/**
 * Global so PermissionsGuard can be applied in any module without every one of
 * them importing this — the guard is meant to be usable anywhere a route needs
 * a permission check.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminAccessController],
  providers: [AdminAccessService],
  exports: [AdminAccessService],
})
export class AdminAccessModule implements OnModuleInit {
  constructor(private access: AdminAccessService) {}

  /**
   * Seed the system role presets on boot. Idempotent, and re-syncs permissions
   * so a deploy that introduces a new permission lands in the presets that
   * should include it without a manual migration step.
   */
  async onModuleInit() {
    try {
      await this.access.ensureSystemRoles();
      // Must run AFTER presets exist — it maps legacy admins onto them.
      await this.access.backfillExistingAdmins();
    } catch {
      // Never block application start on seeding — a failure here degrades to
      // "presets missing", which the API surfaces as an unknown-role error,
      // not a dead service.
    }
  }
}
