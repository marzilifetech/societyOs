import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  categoriesForAudience,
  getCategory,
  isForceOn,
  NotificationAudience,
} from '../../common/notification/notification-categories';
import { PreferenceUpdateDto } from './dto/notifications.dto';

export interface ResolvedPreference {
  key: string;
  label: string;
  description: string;
  importance: string;
  mutable: boolean;
  enabled: boolean;
}

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the full set of categories offered to the audience, left-joined with
   * the user's stored preferences. Force-on categories are always enabled and
   * non-mutable regardless of any stored row.
   */
  async getPreferences(
    userId: string,
    audience: NotificationAudience,
  ): Promise<ResolvedPreference[]> {
    const categories = categoriesForAudience(audience);
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byCategory = new Map(rows.map((r) => [r.category, r]));

    return categories.map((c) => {
      const forceOn = !c.mutable;
      const row = byCategory.get(c.key);
      const enabled = forceOn ? true : (row?.enabled ?? c.defaultEnabled);
      return {
        key: c.key,
        label: c.label,
        description: c.description,
        importance: c.importance,
        mutable: c.mutable,
        enabled,
      };
    });
  }

  /**
   * Applies a batch of preference updates. Unknown and force-on categories are
   * silently skipped (a force-on category cannot be disabled), so a partial
   * batch never errors out as a whole. Returns the refreshed preferences.
   */
  async setPreferences(
    userId: string,
    audience: NotificationAudience,
    updates: PreferenceUpdateDto[],
  ): Promise<ResolvedPreference[]> {
    for (const update of updates) {
      if (!getCategory(update.category)) continue;
      if (isForceOn(update.category)) continue;
      await this.prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: update.category } },
        create: { userId, category: update.category, enabled: update.enabled },
        update: { enabled: update.enabled },
      });
    }
    return this.getPreferences(userId, audience);
  }
}
