import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Coarse type used by both mobile apps to pick the right UX.
 *
 *   none      — current build is at-or-above recommended; no nudge
 *   flexible  — below recommended, at-or-above min; show dismissible banner
 *   immediate — below min; full-screen blocker, single CTA, no skip
 */
export type AppUpdateLevel = 'none' | 'flexible' | 'immediate';

export interface VersionPolicy {
  /** Coarse-grained outcome the apps render directly. */
  level: AppUpdateLevel;
  /** Below this version, the app MUST update before continuing. */
  minVersionCode: number;
  /** At-or-above is "current"; below shows the dismissible flexible banner. */
  recommendedVersionCode: number;
  /** Where the user is sent when they tap "Update Now" (Play Store deep-link or APK URL). */
  updateUrl: string;
  /** Optional user-facing message (e.g. "Critical safety fix included"). */
  updateMessage: string | null;
}

interface PolicyCacheEntry {
  policy: VersionPolicy;
  expiresAt: number;
}

type AppKey = 'resident' | 'staff';

/**
 * Server-side reader for the version-policy used by the in-app update flow.
 *
 * Source of truth — in priority order:
 *   1. Firebase Remote Config (admin.remoteConfig().getTemplate())
 *   2. Environment variables (APP_VERSION_POLICY_RESIDENT_*, *_STAFF_*)
 *   3. Hard defaults that mean "no update required" (level=none)
 *
 * Per-request fetches against the Firebase RC HTTP API are slow (~300ms) AND
 * rate-limited, so we cache the resolved policy for 5 minutes per (app,
 * platform) tuple. That's the same window Firebase's own client SDKs default
 * to — short enough that the dev can flip the toggle and verify within a few
 * minutes, long enough that we don't melt our rate limit on a startup burst.
 *
 * IMPORTANT: This service NEVER throws. The endpoint is hit on every app
 * launch before any login — if Firebase is down or misconfigured, returning
 * level='none' keeps users out of an unrecoverable boot loop. The cache
 * layer also serves stale values across a temporary RC failure.
 */
@Injectable()
export class AppPolicyService {
  private readonly logger = new Logger(AppPolicyService.name);
  private readonly cache = new Map<string, PolicyCacheEntry>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  async getPolicy(app: AppKey, platform: string, currentVersionCode: number): Promise<VersionPolicy> {
    const platformKey = platform === 'ios' ? 'ios' : 'android';
    const cacheKey = `${app}:${platformKey}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    let raw: Omit<VersionPolicy, 'level'>;
    if (cached && cached.expiresAt > now) {
      raw = cached.policy;
    } else {
      raw = await this.fetchPolicy(app, platformKey);
      this.cache.set(cacheKey, { policy: { ...raw, level: 'none' }, expiresAt: now + this.cacheTtlMs });
    }

    // level is derived from the CURRENT app — never cached.
    return { ...raw, level: this.deriveLevel(currentVersionCode, raw) };
  }

  private deriveLevel(
    current: number,
    policy: { minVersionCode: number; recommendedVersionCode: number },
  ): AppUpdateLevel {
    if (!Number.isFinite(current) || current <= 0) return 'none';
    if (current < policy.minVersionCode) return 'immediate';
    if (current < policy.recommendedVersionCode) return 'flexible';
    return 'none';
  }

  private async fetchPolicy(app: AppKey, platform: 'android' | 'ios'): Promise<Omit<VersionPolicy, 'level'>> {
    // 1. Firebase Remote Config — only attempt if firebase-admin has been
    //    initialized by another module (push.service.ts). Calling getTemplate()
    //    without an initialized app would throw "Default app does not exist".
    if (admin.apps.length > 0) {
      try {
        const template = await admin.remoteConfig().getTemplate();
        const params = template.parameters ?? {};
        const min = this.readNumberParam(params, this.key(app, platform, 'min'));
        const rec = this.readNumberParam(params, this.key(app, platform, 'recommended'));
        const url = this.readStringParam(params, this.key(app, platform, 'update_url'));
        const msg = this.readStringParam(params, this.key(app, platform, 'update_message'));
        if (min != null && rec != null) {
          return {
            minVersionCode: min,
            recommendedVersionCode: rec,
            updateUrl: url ?? this.defaultStoreUrl(app, platform),
            updateMessage: msg,
          };
        }
      } catch (err) {
        // Includes: template doesn't exist, no permission, transient HTTP error.
        // Fall through to env / hard defaults.
        this.logger.warn(`Remote Config read failed for ${app}/${platform}: ${(err as Error).message}`);
      }
    }

    // 2. Env fallback. Useful for dev where Firebase Remote Config isn't
    //    configured yet but we still want to test the gate UX.
    const envMin = this.parseInt(this.config.get<string>(`APP_VERSION_MIN_${app.toUpperCase()}_${platform.toUpperCase()}`));
    const envRec = this.parseInt(this.config.get<string>(`APP_VERSION_RECOMMENDED_${app.toUpperCase()}_${platform.toUpperCase()}`));
    const envUrl = this.config.get<string>(`APP_VERSION_URL_${app.toUpperCase()}_${platform.toUpperCase()}`);

    return {
      minVersionCode: envMin ?? 0,
      recommendedVersionCode: envRec ?? 0,
      updateUrl: envUrl ?? this.defaultStoreUrl(app, platform),
      updateMessage: null,
    };
  }

  // ─── Remote Config helpers ────────────────────────────────────────────────

  private key(app: AppKey, platform: 'android' | 'ios', kind: 'min' | 'recommended' | 'update_url' | 'update_message'): string {
    if (kind === 'min' || kind === 'recommended') {
      return `${kind}_version_code_${app}_${platform}`;
    }
    return `${kind}_${app}_${platform}`;
  }

  private readNumberParam(params: Record<string, admin.remoteConfig.RemoteConfigParameter>, key: string): number | null {
    const v = params[key]?.defaultValue;
    if (!v || !('value' in v) || typeof v.value !== 'string') return null;
    return this.parseInt(v.value);
  }

  private readStringParam(params: Record<string, admin.remoteConfig.RemoteConfigParameter>, key: string): string | null {
    const v = params[key]?.defaultValue;
    if (!v || !('value' in v) || typeof v.value !== 'string') return null;
    const trimmed = v.value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseInt(value: string | undefined | null): number | null {
    if (value == null) return null;
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private defaultStoreUrl(app: AppKey, platform: 'android' | 'ios'): string {
    if (platform === 'ios') {
      return 'https://apps.apple.com/'; // overridden once iOS shipping starts
    }
    const pkg = app === 'staff' ? 'com.societyos.staff' : 'com.societyos.resident';
    return `https://play.google.com/store/apps/details?id=${pkg}`;
  }
}
