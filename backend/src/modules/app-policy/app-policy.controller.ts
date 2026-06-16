import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppPolicyService, VersionPolicy } from './app-policy.service';

/**
 * PUBLIC endpoint hit by both mobile apps on every cold start, BEFORE auth.
 * Auth is intentionally NOT required — if we gated it behind login, a force-
 * required update couldn't kick in until after the user signed in, which
 * defeats the whole point.
 *
 * Apps pass their running platform + app-id + versionCode; we return the
 * effective level (none / flexible / immediate) and a CTA URL. Apps make
 * routing decisions client-side from the `level` field.
 *
 * Why on this controller and not /v1/app/...? Other public probes (/health,
 * /metrics) sit at the root too — clients shouldn't have to know about
 * versioned vs. unversioned prefixes for a boot-time check.
 */
@ApiTags('app-policy')
@Controller('app')
export class AppPolicyController {
  constructor(private readonly service: AppPolicyService) {}

  @Get('version-policy')
  async getVersionPolicy(
    @Query('app') app?: string,
    @Query('platform') platform?: string,
    @Query('versionCode') versionCode?: string,
  ): Promise<VersionPolicy> {
    // Defensive normalization. We never throw — see the service's "never
    // throws" contract for why.
    const appKey = app === 'staff' ? 'staff' : 'resident';
    const platformKey = platform === 'ios' ? 'ios' : 'android';
    const current = Number.parseInt(versionCode ?? '0', 10) || 0;
    return this.service.getPolicy(appKey, platformKey, current);
  }
}
