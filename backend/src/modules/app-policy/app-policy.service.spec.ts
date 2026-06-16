import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppPolicyService } from './app-policy.service';

// Mock firebase-admin so we don't try to hit Google. jest.mock() factories
// hoist to the very top of the file, so they cannot close over outer-scope
// variables — we therefore put the mutable state on `globalThis` and let
// both the mock and the tests below reach in. Ugly but standard jest dance.
jest.mock('firebase-admin', () => ({
  __esModule: true,
  get apps() { return (globalThis as any).__fbApps__ ?? []; },
  remoteConfig: () => ({
    getTemplate: () => (globalThis as any).__fbGetTemplate__(),
  }),
}));

const setFbAppsInitialized = (init: boolean) => {
  (globalThis as any).__fbApps__ = init ? [{}] : [];
};
const setFbGetTemplate = (fn: jest.Mock) => {
  (globalThis as any).__fbGetTemplate__ = fn;
};

describe('AppPolicyService', () => {
  let service: AppPolicyService;
  let configMap: Record<string, string | undefined>;

  beforeEach(async () => {
    configMap = {};
    setFbAppsInitialized(false);
    setFbGetTemplate(jest.fn());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPolicyService,
        {
          provide: ConfigService,
          useValue: { get: (k: string) => configMap[k] },
        },
      ],
    }).compile();
    service = module.get(AppPolicyService);
  });

  describe('level derivation (env fallback)', () => {
    beforeEach(() => {
      configMap = {
        APP_VERSION_MIN_RESIDENT_ANDROID: '10',
        APP_VERSION_RECOMMENDED_RESIDENT_ANDROID: '12',
        APP_VERSION_URL_RESIDENT_ANDROID: 'https://example.test/apk',
      };
    });

    it('returns level=none at-or-above recommended', async () => {
      const p = await service.getPolicy('resident', 'android', 12);
      expect(p.level).toBe('none');
      expect(p.minVersionCode).toBe(10);
      expect(p.recommendedVersionCode).toBe(12);
    });

    it('returns level=none well above recommended', async () => {
      const p = await service.getPolicy('resident', 'android', 999);
      expect(p.level).toBe('none');
    });

    it('returns level=flexible when below recommended but at-or-above min', async () => {
      const p = await service.getPolicy('resident', 'android', 11);
      expect(p.level).toBe('flexible');
    });

    it('returns level=flexible at exactly min', async () => {
      const p = await service.getPolicy('resident', 'android', 10);
      expect(p.level).toBe('flexible');
    });

    it('returns level=immediate below min', async () => {
      const p = await service.getPolicy('resident', 'android', 9);
      expect(p.level).toBe('immediate');
    });

    it('returns level=none for unknown/zero versionCode (e.g. Expo Go)', async () => {
      const p = await service.getPolicy('resident', 'android', 0);
      expect(p.level).toBe('none');
    });
  });

  describe('safe defaults when nothing is configured', () => {
    it('returns minVersionCode=0 and level=none', async () => {
      const p = await service.getPolicy('staff', 'android', 5);
      expect(p.minVersionCode).toBe(0);
      expect(p.recommendedVersionCode).toBe(0);
      expect(p.level).toBe('none');
      // Default URL should be the Play Store deep-link for the right package.
      expect(p.updateUrl).toMatch(/com\.societyos\.staff/);
    });

    it('returns level=none for staff app with current=1 and no config', async () => {
      const p = await service.getPolicy('staff', 'android', 1);
      // current=1 is above min=0 and rec=0 → none.
      expect(p.level).toBe('none');
    });
  });

  describe('Firebase Remote Config happy path', () => {
    beforeEach(() => {
      setFbAppsInitialized(true);
      setFbGetTemplate(
        jest.fn().mockResolvedValue({
          parameters: {
            min_version_code_resident_android: { defaultValue: { value: '15' } },
            recommended_version_code_resident_android: { defaultValue: { value: '18' } },
            update_url_resident_android: { defaultValue: { value: 'https://rc.example/apk' } },
            update_message_resident_android: { defaultValue: { value: 'Critical security fix' } },
          },
        }),
      );
    });

    it('reads min, recommended, url, and message from RC and ignores env', async () => {
      configMap.APP_VERSION_MIN_RESIDENT_ANDROID = '99'; // would lose if env won
      const p = await service.getPolicy('resident', 'android', 17);
      expect(p.minVersionCode).toBe(15);
      expect(p.recommendedVersionCode).toBe(18);
      expect(p.updateUrl).toBe('https://rc.example/apk');
      expect(p.updateMessage).toBe('Critical security fix');
      expect(p.level).toBe('flexible'); // 17 < 18 but >= 15
    });

    it('falls back to env when RC throws', async () => {
      configMap = {
        APP_VERSION_MIN_RESIDENT_ANDROID: '7',
        APP_VERSION_RECOMMENDED_RESIDENT_ANDROID: '8',
      };
      setFbGetTemplate(jest.fn().mockRejectedValueOnce(new Error('rate limit')));
      const p = await service.getPolicy('resident', 'android', 6);
      expect(p.minVersionCode).toBe(7);
      expect(p.recommendedVersionCode).toBe(8);
      expect(p.level).toBe('immediate'); // 6 < 7
    });
  });

  describe('caching', () => {
    it('serves the same policy twice without re-reading config', async () => {
      configMap = {
        APP_VERSION_MIN_RESIDENT_ANDROID: '10',
        APP_VERSION_RECOMMENDED_RESIDENT_ANDROID: '12',
      };
      const spy = jest.fn((k: string) => configMap[k]);
      // Replace the inner ConfigService.get with a spy mid-flight.
      (service as unknown as { config: { get: typeof spy } }).config.get = spy;
      await service.getPolicy('resident', 'android', 11);
      const callsAfterFirst = spy.mock.calls.length;
      await service.getPolicy('resident', 'android', 11);
      // Second call should NOT re-read env vars: cache hit.
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });

    it('derives a fresh level per request even from a cached policy', async () => {
      configMap = {
        APP_VERSION_MIN_RESIDENT_ANDROID: '10',
        APP_VERSION_RECOMMENDED_RESIDENT_ANDROID: '12',
      };
      const a = await service.getPolicy('resident', 'android', 8); // immediate
      const b = await service.getPolicy('resident', 'android', 12); // none
      expect(a.level).toBe('immediate');
      expect(b.level).toBe('none');
      expect(a.minVersionCode).toBe(b.minVersionCode);
    });
  });
});
