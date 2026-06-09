import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  device: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DevicesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('upserts keyed on the unique token', async () => {
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd-1' });

      await service.registerDevice('user-1', {
        token: 'tok-abc',
        platform: 'ios',
        appType: 'resident',
      });

      expect(mockPrisma.device.upsert).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.device.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ token: 'tok-abc' });
      expect(arg.create).toMatchObject({
        userId: 'user-1',
        token: 'tok-abc',
        platform: 'ios',
        appType: 'resident',
      });
    });

    it('reassigns userId on update when the token moves to a new user', async () => {
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd-1' });

      await service.registerDevice('new-user', {
        token: 'tok-abc',
        platform: 'android',
      });

      const arg = mockPrisma.device.upsert.mock.calls[0][0];
      expect(arg.update.userId).toBe('new-user');
      expect(arg.update.platform).toBe('android');
      expect(arg.update.lastSeenAt).toBeInstanceOf(Date);
    });
  });

  describe('removeDevice', () => {
    it('scopes deletion to both token and userId', async () => {
      mockPrisma.device.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeDevice('user-1', 'tok-abc');

      expect(mockPrisma.device.deleteMany).toHaveBeenCalledWith({
        where: { token: 'tok-abc', userId: 'user-1' },
      });
      expect(result).toEqual({ deleted: true });
    });

    it('reports not deleted when nothing matched', async () => {
      mockPrisma.device.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.removeDevice('user-1', 'other-token');

      expect(result).toEqual({ deleted: false });
    });
  });

  describe('listDevices', () => {
    it('lists devices for the user', async () => {
      const devices = [{ id: 'd-1' }];
      mockPrisma.device.findMany.mockResolvedValue(devices);

      const result = await service.listDevices('user-1');

      expect(result).toEqual(devices);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
