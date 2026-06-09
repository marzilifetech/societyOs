import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesService } from './preferences.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  notificationPreference: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PreferencesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('returns registry defaults when the user has no stored rows', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

      const prefs = await service.getPreferences('user-1', 'resident');

      // 'complaints' is a mutable resident category, defaultEnabled true.
      const complaints = prefs.find((p) => p.key === 'complaints');
      expect(complaints).toMatchObject({ mutable: true, enabled: true });
      // every resident category is present
      expect(prefs.length).toBeGreaterThan(0);
    });

    it('reflects a stored enabled:false on a mutable category', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-1', category: 'complaints', enabled: false },
      ]);

      const prefs = await service.getPreferences('user-1', 'resident');

      const complaints = prefs.find((p) => p.key === 'complaints');
      expect(complaints).toMatchObject({ mutable: true, enabled: false });
    });

    it('keeps a force-on category always enabled:true & mutable:false even if a row says false', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-1', category: 'emergency_sos', enabled: false },
      ]);

      const prefs = await service.getPreferences('user-1', 'resident');

      const sos = prefs.find((p) => p.key === 'emergency_sos');
      expect(sos).toMatchObject({ mutable: false, enabled: true });
    });
  });

  describe('setPreferences', () => {
    it('ignores force-on updates (no upsert) but applies mutable ones', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
      mockPrisma.notificationPreference.upsert.mockResolvedValue({});

      await service.setPreferences('user-1', 'resident', [
        { category: 'emergency_sos', enabled: false }, // force-on -> skipped
        { category: 'complaints', enabled: false }, // mutable -> applied
        { category: 'does_not_exist', enabled: false }, // unknown -> skipped
      ]);

      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.notificationPreference.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({
        userId_category: { userId: 'user-1', category: 'complaints' },
      });
      expect(arg.create).toMatchObject({ userId: 'user-1', category: 'complaints', enabled: false });
      expect(arg.update).toEqual({ enabled: false });
    });

    it('returns the refreshed preferences after applying', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({});
      mockPrisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-1', category: 'complaints', enabled: false },
      ]);

      const result = await service.setPreferences('user-1', 'resident', [
        { category: 'complaints', enabled: false },
      ]);

      const complaints = result.find((p) => p.key === 'complaints');
      expect(complaints?.enabled).toBe(false);
    });
  });
});
