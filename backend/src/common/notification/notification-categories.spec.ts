import {
  NOTIFICATION_CATEGORIES,
  categoriesForAudience,
  getCategory,
  getNotificationType,
  isCategoryMutable,
  isForceOn,
} from './notification-categories';

/**
 * Notification category registry is the single source of truth for the
 * 3-type taxonomy (MARKETING / DELIVERY / EMERGENCY). Mistyping a key here
 * silently routes a payload through the wrong channel + sound + DND policy,
 * so these tests pin the contract.
 */
describe('notification-categories', () => {
  describe('registry invariants', () => {
    it('every entry carries a coarse type', () => {
      for (const cat of NOTIFICATION_CATEGORIES) {
        expect(['MARKETING', 'DELIVERY', 'EMERGENCY']).toContain(cat.type);
      }
    });

    it('every entry routes to a known Android channel', () => {
      const channels = [
        'emergency_sos',
        'approvals',
        'deliveries',
        'community',
        'payments',
        'system',
      ];
      for (const cat of NOTIFICATION_CATEGORIES) {
        expect(channels).toContain(cat.channelId);
      }
    });

    it('pins the contract channel routing for key categories', () => {
      expect(getCategory('emergency_sos')?.channelId).toBe('emergency_sos');
      expect(getCategory('visitors_gate')?.channelId).toBe('approvals');
      expect(getCategory('approval_results')?.channelId).toBe('approvals');
      expect(getCategory('staff_tasks')?.channelId).toBe('approvals');
      expect(getCategory('deliveries')?.channelId).toBe('deliveries');
      expect(getCategory('notices')?.channelId).toBe('community');
      expect(getCategory('notices_urgent')?.channelId).toBe('community');
      expect(getCategory('payments_dues')?.channelId).toBe('payments');
      expect(getCategory('account_auth')?.channelId).toBe('system');
    });

    it('force-on categories (mutable=false) include emergency_sos', () => {
      expect(isForceOn('emergency_sos')).toBe(true);
    });

    it('mutable=true categories cannot be silenced server-side', () => {
      expect(isForceOn('notices')).toBe(false);
      expect(isCategoryMutable('notices')).toBe(true);
    });

    it('keys are unique across the registry', () => {
      const seen = new Set<string>();
      for (const c of NOTIFICATION_CATEGORIES) {
        expect(seen.has(c.key)).toBe(false);
        seen.add(c.key);
      }
    });
  });

  describe('getNotificationType — registry hits', () => {
    it('emergency_sos -> EMERGENCY', () => {
      expect(getNotificationType('emergency_sos')).toBe('EMERGENCY');
    });

    it('visitors_gate -> DELIVERY', () => {
      expect(getNotificationType('visitors_gate')).toBe('DELIVERY');
    });

    it('deliveries -> DELIVERY', () => {
      expect(getNotificationType('deliveries')).toBe('DELIVERY');
    });

    it('notices -> MARKETING (default tone, not urgent)', () => {
      expect(getNotificationType('notices')).toBe('MARKETING');
    });

    it('daily_help -> MARKETING', () => {
      expect(getNotificationType('daily_help')).toBe('MARKETING');
    });

    it('account_auth (force-on) -> DELIVERY (lockscreen visible)', () => {
      // OTP / login alerts should reach lockscreen but aren't emergencies.
      expect(getNotificationType('account_auth')).toBe('DELIVERY');
    });
  });

  describe('getNotificationType — legacy / unknown keys', () => {
    it("legacy 'sos' alias -> EMERGENCY", () => {
      expect(getNotificationType('sos')).toBe('EMERGENCY');
    });

    it('SOS_TRIGGERED (data.type from old payloads) -> EMERGENCY', () => {
      expect(getNotificationType('SOS_TRIGGERED')).toBe('EMERGENCY');
    });

    it('unknown VISITOR_* string -> DELIVERY', () => {
      expect(getNotificationType('VISITOR_APPROVAL_REQUEST')).toBe('DELIVERY');
    });

    it('unknown package-shaped string -> DELIVERY', () => {
      expect(getNotificationType('PACKAGE_ARRIVED')).toBe('DELIVERY');
    });

    it('totally unknown string -> MARKETING (safe default)', () => {
      expect(getNotificationType('cosmic_ray')).toBe('MARKETING');
    });

    it('null / undefined / empty -> MARKETING', () => {
      expect(getNotificationType(null)).toBe('MARKETING');
      expect(getNotificationType(undefined)).toBe('MARKETING');
      expect(getNotificationType('')).toBe('MARKETING');
    });

    it('case-insensitive on legacy aliases', () => {
      expect(getNotificationType('SOS')).toBe('EMERGENCY');
      expect(getNotificationType('Emergency_Alert')).toBe('EMERGENCY');
    });
  });

  describe('categoriesForAudience', () => {
    it("resident audience excludes staff-only categories like 'staff_tasks'", () => {
      const resident = categoriesForAudience('resident');
      expect(resident.some((c) => c.key === 'staff_tasks')).toBe(false);
    });

    it('staff audience includes approval_results', () => {
      const staff = categoriesForAudience('staff');
      expect(staff.some((c) => c.key === 'approval_results')).toBe(true);
    });

    it('admin audience includes notices_urgent', () => {
      const admin = categoriesForAudience('admin');
      expect(admin.some((c) => c.key === 'notices_urgent')).toBe(true);
    });
  });

  describe('getCategory', () => {
    it('returns the full record for a known key', () => {
      const cat = getCategory('deliveries');
      expect(cat?.type).toBe('DELIVERY');
      expect(cat?.actionable).toBe(true);
    });

    it('returns undefined for unknown keys', () => {
      expect(getCategory('totally_made_up')).toBeUndefined();
    });
  });
});
