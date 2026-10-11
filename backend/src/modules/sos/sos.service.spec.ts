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
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

const mockPush = {
  sendToSociety: jest.fn().mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 }),
};

const flush = () => new Promise((r) => setImmediate(r));

const mockRealtime = { emitSosAlert: jest.fn(), emitSosToOwner: jest.fn() };

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
        { provide: RealtimeGateway, useValue: mockRealtime },
        { provide: PushService, useValue: mockPush },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<SosService>(SosService);
    jest.clearAllMocks();
    mockPush.sendToSociety.mockResolvedValue({ sent: 0, failed: 0, cleaned: 0 });
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

    it('pushes SOS_TRIGGERED to STAFF and to ADMIN + BUILDING_ADMIN, both critical, with the alert id', async () => {
      const alert = { id: 'sos-1', status: SosStatus.ACTIVE };
      mockPrisma.sosAlert.create.mockResolvedValue(alert);

      await service.trigger('res-1', 'soc-1', 12.9716, 77.5946);
      await flush();

      const payload = expect.objectContaining({
        type: 'SOS_TRIGGERED',
        entityId: 'sos-1',
        alertId: 'sos-1',
      });
      expect(mockPush.sendToSociety).toHaveBeenCalledWith(
        'soc-1',
        UserRole.STAFF,
        expect.objectContaining({ category: 'emergency_sos', critical: true }),
        payload,
      );
      expect(mockPush.sendToSociety).toHaveBeenCalledWith(
        'soc-1',
        [UserRole.ADMIN, UserRole.BUILDING_ADMIN],
        expect.objectContaining({ category: 'emergency_sos', critical: true }),
        payload,
      );
    });

    it('names the person and flat in the push', async () => {
      mockPrisma.sosAlert.create.mockResolvedValue({ id: 'sos-1', status: SosStatus.ACTIVE });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        name: 'Asha',
        resident: { flat: { block: 'B', number: '204' } },
      });

      await service.trigger('res-1', 'soc-1');
      await flush();

      const [, , notification, data] = mockPush.sendToSociety.mock.calls[0];
      expect(notification.body).toContain('Asha at B-204');
      expect(data).toEqual(expect.objectContaining({ raisedByName: 'Asha', flat: 'B-204' }));
    });

    it('never fails the trigger when pushes fail', async () => {
      mockPrisma.sosAlert.create.mockResolvedValue({ id: 'sos-1', status: SosStatus.ACTIVE });
      mockPush.sendToSociety.mockRejectedValue(new Error('fcm down'));
      await expect(service.trigger('res-1', 'soc-1')).resolves.toEqual(
        expect.objectContaining({ id: 'sos-1' }),
      );
      await flush();
    });
  });

  describe('acknowledge', () => {
    it("is scoped to the caller's society — another society's alert is not found", async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValue(null);

      await expect(service.acknowledge('sos-1', 'staff-1', 'other-soc')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.sosAlert.findFirst).toHaveBeenCalledWith({
        where: { id: 'sos-1', societyId: 'other-soc' },
      });
      expect(mockPrisma.sosAlert.updateMany).not.toHaveBeenCalled();
    });

    it('calculates responseTimeSecs and sets ACKNOWLEDGED only if still ACTIVE', async () => {
      const createdAt = new Date(Date.now() - 30_000); // 30 seconds ago
      mockPrisma.sosAlert.findFirst
        .mockResolvedValueOnce({ id: 'sos-1', createdAt, status: SosStatus.ACTIVE })
        .mockResolvedValueOnce({ id: 'sos-1', status: SosStatus.ACKNOWLEDGED });

      const result = await service.acknowledge('sos-1', 'staff-1', 'soc-1');

      const call = mockPrisma.sosAlert.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'sos-1', societyId: 'soc-1', status: SosStatus.ACTIVE });
      expect(call.data.status).toBe(SosStatus.ACKNOWLEDGED);
      expect(call.data.acknowledgedBy).toBe('staff-1');
      expect(call.data.responseTimeSecs).toBeGreaterThanOrEqual(29);
      expect(call.data.responseTimeSecs).toBeLessThanOrEqual(31);
      expect(result.status).toBe(SosStatus.ACKNOWLEDGED);
    });

    it('a second responder gets the alert back unchanged (first acknowledgement stands)', async () => {
      const acked = { id: 'sos-1', status: SosStatus.ACKNOWLEDGED, acknowledgedBy: 'staff-1' };
      mockPrisma.sosAlert.findFirst.mockResolvedValue(acked);

      await expect(service.acknowledge('sos-1', 'staff-2', 'soc-1')).resolves.toBe(acked);
      expect(mockPrisma.sosAlert.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to acknowledge a closed alert', async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValue({ id: 'sos-1', status: SosStatus.RESOLVED });
      await expect(service.acknowledge('sos-1', 'staff-1', 'soc-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('resolve', () => {
    it("is scoped to the caller's society", async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValue(null);
      await expect(service.resolve('sos-1', 'other-soc')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sosAlert.update).not.toHaveBeenCalled();
    });

    it('closes an open alert, and is a no-op on a closed one', async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValueOnce({ id: 'sos-1', status: SosStatus.ACKNOWLEDGED });
      mockPrisma.sosAlert.update.mockResolvedValue({ id: 'sos-1', status: SosStatus.RESOLVED });
      await service.resolve('sos-1', 'soc-1');
      expect(mockPrisma.sosAlert.update.mock.calls[0][0].data.status).toBe(SosStatus.RESOLVED);

      mockPrisma.sosAlert.findFirst.mockResolvedValueOnce({ id: 'sos-1', status: SosStatus.RESOLVED });
      await service.resolve('sos-1', 'soc-1');
      expect(mockPrisma.sosAlert.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActive', () => {
    it('returns open alerts (active + acknowledged) with no secrets about the person', async () => {
      mockPrisma.sosAlert.findMany.mockResolvedValue([]);
      await service.getActive('soc-1');
      const args = mockPrisma.sosAlert.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        societyId: 'soc-1',
        status: { in: [SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED] },
      });
      expect(args.include).toBeUndefined();
      const personFields = Object.keys(args.select.resident.select);
      expect(personFields).not.toEqual(expect.arrayContaining(['totpSecret']));
      expect(personFields).not.toContain('fcmToken');
      expect(personFields).not.toContain('email');
    });
  });

  describe('flagFalseAlarm', () => {
    const residentActor = (sub: string): JwtPayload => ({
      sub,
      phone: '+1',
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
    });

    it('resident: can cancel their own alert after the old 5 s window, even once acknowledged', async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValue({
        id: 'sos-1',
        societyId: 'soc-1',
        residentId: 'res-user-1',
        status: SosStatus.ACKNOWLEDGED,
        createdAt: new Date(Date.now() - 60_000),
      });
      mockPrisma.sosAlert.update.mockResolvedValue({
        id: 'sos-1',
        societyId: 'soc-1',
        residentId: 'res-user-1',
        status: SosStatus.FALSE_ALARM,
      });

      await service.flagFalseAlarm('sos-1', residentActor('res-user-1'), 'soc-1');

      expect(mockPrisma.sosAlert.update).toHaveBeenCalledWith({
        where: { id: 'sos-1' },
        data: { status: SosStatus.FALSE_ALARM },
      });
      expect(mockRealtime.emitSosToOwner).toHaveBeenCalledWith(
        'soc-1',
        'res-user-1',
        'sos:sos-1:closed',
        { alertId: 'sos-1', status: SosStatus.FALSE_ALARM },
      );
    });

    it("resident: cannot cancel someone else's alert", async () => {
      mockPrisma.sosAlert.findFirst.mockResolvedValue({
        id: 'sos-1',
        residentId: 'someone-else',
        status: SosStatus.ACTIVE,
        createdAt: new Date(),
      });
      await expect(service.flagFalseAlarm('sos-1', residentActor('res-user-1'), 'soc-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOS_NOT_OWNER' }),
      });
    });

    it('resident: can resolve their own alert but not another one', async () => {
      const open = { id: 'sos-1', societyId: 'soc-1', residentId: 'res-user-1', status: SosStatus.ACTIVE };
      mockPrisma.sosAlert.findFirst.mockResolvedValue(open);
      mockPrisma.sosAlert.update.mockResolvedValue({ ...open, status: SosStatus.RESOLVED });

      await expect(service.resolve('sos-1', 'soc-1', residentActor('res-user-1'))).resolves.toMatchObject({
        status: SosStatus.RESOLVED,
      });
      await expect(service.resolve('sos-1', 'soc-1', residentActor('intruder'))).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOS_NOT_OWNER' }),
      });
    });

    it('STAFF can mark false alarm regardless of cancel window age', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T01:00:00.000Z') });
      const oldActive = {
        id: 'sos-old',
        residentId: 'res-user-1',
        status: SosStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockPrisma.sosAlert.findFirst.mockResolvedValue(oldActive);
      mockPrisma.sosAlert.update.mockResolvedValue({ ...oldActive, status: SosStatus.FALSE_ALARM });

      const staffActor: JwtPayload = {
        sub: 'staff-u1',
        phone: '+2',
        role: UserRole.STAFF,
        societyId: 'soc-1',
      };

      const result = await service.flagFalseAlarm('sos-old', staffActor, 'soc-1');
      expect(result.status).toBe(SosStatus.FALSE_ALARM);
      expect(mockPrisma.sosAlert.update).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('ADMIN skips cancel window (ACKNOWLEDGED + stale still allowed)', async () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T02:00:00.000Z') });
      mockPrisma.sosAlert.findFirst.mockResolvedValue({
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

      await service.flagFalseAlarm('sos-ak', adminActor, 'soc-1');
      expect(mockPrisma.sosAlert.update).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

});
