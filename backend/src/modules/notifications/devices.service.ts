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
    // A phone's token belongs to whoever signed in on it LAST. The Device row
    // moves with the upsert below, but push also reads the legacy
    // `user.fcmToken` column, which still pointed the previous owner's pushes
    // at this phone — on a shared guard phone, guard A's tasks and approvals
    // kept arriving after guard B signed in.
    await this.prisma.user.updateMany({
      where: { fcmToken: dto.token, id: { not: userId } },
      data: { fcmToken: null },
    });
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

  /** Forget a push token for everyone (see DeviceReleaseController). */
  async releaseDevice(token: string) {
    const [{ count }] = await this.prisma.$transaction([
      this.prisma.device.deleteMany({ where: { token } }),
      this.prisma.user.updateMany({ where: { fcmToken: token }, data: { fcmToken: null } }),
    ]);
    return { released: count > 0 };
  }

  async removeDevice(userId: string, token: string) {
    const { count } = await this.prisma.device.deleteMany({
      where: { token, userId },
    });
    return { deleted: count > 0 };
  }
}
