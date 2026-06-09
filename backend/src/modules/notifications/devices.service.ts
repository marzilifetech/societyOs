import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicePlatform } from '@prisma/client';
import { RegisterDeviceDto } from './dto/notifications.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registers (or re-registers) a push token. Upserts on the unique `token` so
   * that a token moving to a new user/device reassigns cleanly instead of
   * colliding on the unique constraint.
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const platform = dto.platform as DevicePlatform;
    return this.prisma.device.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform,
        appType: dto.appType,
      },
      update: {
        userId,
        platform,
        appType: dto.appType,
        lastSeenAt: new Date(),
      },
    });
  }

  async listDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async removeDevice(userId: string, token: string) {
    const { count } = await this.prisma.device.deleteMany({
      where: { token, userId },
    });
    return { deleted: count > 0 };
  }
}
