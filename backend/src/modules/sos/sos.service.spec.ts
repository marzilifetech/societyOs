import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SosService } from './sos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';
import { SosStatus, UserRole } from '@prisma/client';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

const mockPrisma = {
  sosAlert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('SosService', () => {
  let service: SosService;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    config = { get: jest.fn() };
    config.get.mockImplementation((key: string) => {
      if (key === 'SOS_CANCEL_WINDOW_MS') return '5000';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeGateway, useValue: { emitSosAlert: jest.fn() } },
        { provide: PushService, useValue: { sendToSociety: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<SosService>(SosService);
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'SOS_CANCEL_WINDOW_MS') return '5000';
      return undefined;
    });
  });

  describe('trigger', () => {
    it('creates an ACTIVE SOS alert with location', async () => {
      const alert = { id: 'sos-1', status: SosStatus.ACTIVE };
      mockPrisma.sosAlert.create.mockResolvedValue(alert);

      const result = await service.trigger('res-1', 'soc-1', 12.9716, 77.5946);

      expect(result).toEqual(alert);
      expect(mockPrisma.sosAlert.create).toHaveBeenCalledWith({
        data: {
          residentId: 'res-1',
          societyId: 'soc-1',
          lat: 12.9716,
          lng: 77.5946,
          status: SosStatus.ACTIVE,
        },
      });
    });
  });

  describe('acknowledge', () => {
    it('throws NotFoundException when alert does not exist', async () => {
      mockPrisma.sosAlert.findUnique.mockResolvedValue(null);

      await expect(service.acknowledge('nonexistent', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('calculates responseTimeSecs and sets ACKNOWLEDGED status', async () => {
      const createdAt = new Date(Date.now() - 30_000); // 30 seconds ago
      mockPrisma.sosAlert.findUnique.mockResolvedValue({ id: 'sos-1', createdAt });
      mockPrisma.sosAlert.update.mockResolvedValue({ id: 'sos-1', status: SosStatus.ACKNOWLEDGED });

      await service.acknowledge('sos-1', 'staff-1');

      const updateCall = mockPrisma.sosAlert.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(SosStatus.ACKNOWLEDGED);
      expect(updateCall.data.acknowledgedBy).toBe('staff-1');
      expect(updateCall.data.responseTimeSecs).toBeGreaterThanOrEqual(29);
      expect(updateCall.data.responseTimeSecs).toBeLessThanOrEqual(31);
    });
  });

  describe('flagFalseAlarm', () => {
    const residentActor = (sub: string): JwtPayload => ({
      sub,
      phone: '+1',
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
    });

    it('resident: cancel after window expires yields SOS_CANCEL_WINDOW_EXPIRED', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T00:00:10.000Z') });
      mockPrisma.sosAlert.findUnique.mockResolvedValue({
        id: 'sos-1',
        residentId: 'res-user-1',
        status: SosStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00.000Z'), // 10s ago, window 5s
      });

      await expect(service.flagFalseAlarm('sos-1', residentActor('res-user-1'))).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOS_CANCEL_WINDOW_EXPIRED' }),
      });
      expect(mockPrisma.sosAlert.update).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('STAFF can mark false alarm regardless of cancel window age', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T01:00:00.000Z') });
      const oldActive = {
        id: 'sos-old',
        residentId: 'res-user-1',
        status: SosStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockPrisma.sosAlert.findUnique.mockResolvedValue(oldActive);
      mockPrisma.sosAlert.update.mockResolvedValue({ ...oldActive, status: SosStatus.FALSE_ALARM });

      const staffActor: JwtPayload = {
        sub: 'staff-u1',
        phone: '+2',
        role: UserRole.STAFF,
        societyId: 'soc-1',
      };

      const result = await service.flagFalseAlarm('sos-old', staffActor);
      expect(result.status).toBe(SosStatus.FALSE_ALARM);
      expect(mockPrisma.sosAlert.update).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('ADMIN skips cancel window (ACKNOWLEDGED + stale still allowed)', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T02:00:00.000Z') });
      mockPrisma.sosAlert.findUnique.mockResolvedValue({
        id: 'sos-ak',
        residentId: 'res-user-1',
        status: SosStatus.ACKNOWLEDGED,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      mockPrisma.sosAlert.update.mockResolvedValue({ id: 'sos-ak', status: SosStatus.FALSE_ALARM });

      const adminActor: JwtPayload = {
        sub: 'admin-u1',
        phone: '+3',
        role: UserRole.ADMIN,
        societyId: 'soc-1',
      };

      await service.flagFalseAlarm('sos-ak', adminActor);
      expect(mockPrisma.sosAlert.update).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('getActive', () => {
    it('returns only ACTIVE alerts for the society', async () => {
      const alerts = [{ id: 'sos-1', status: SosStatus.ACTIVE }];
      mockPrisma.sosAlert.findMany.mockResolvedValue(alerts);

      const result = await service.getActive('soc-1');

      expect(result).toEqual(alerts);
      expect(mockPrisma.sosAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { societyId: 'soc-1', status: SosStatus.ACTIVE },
        }),
      );
    });
  });
});
