import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { PackageGateway } from './package.gateway';

@Injectable()
export class PackageService {
  private readonly logger = new Logger(PackageService.name);
  constructor(
    private prisma: PrismaService,
    private packageGateway: PackageGateway,
  ) {}

  async logArrival(
    guardUserId: string,
    societyId: string,
    dto: {
      residentId: string;
      courierName: string;
      trackingNumber?: string;
      description?: string;
      photoUrl: string;
    },
  ) {
    const resident = await this.prisma.resident.findUnique({
      where: { id: dto.residentId },
      include: { flat: true },
    });
    if (!resident) {
      throw new NotFoundException({ code: 'RESIDENT_NOT_FOUND', message: 'Resident not found' });
    }
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'RESIDENT_SOCIETY_MISMATCH', message: 'Resident does not belong to this society' });
    }

    const pkg = await this.prisma.package.create({
      data: {
        residentId: dto.residentId,
        societyId,
        courierName: dto.courierName,
        trackingNumber: dto.trackingNumber,
        description: dto.description,
        photoUrl: dto.photoUrl,
      },
    });

    this.packageGateway.emitPackageArrived(pkg.residentId, {
      packageId: pkg.id,
      courierName: pkg.courierName,
      trackingNumber: pkg.trackingNumber ?? null,
      arrivedAt: pkg.arrivedAt.toISOString(),
    });

    return pkg;
  }

  async findByResident(userId: string, societyId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'RESIDENT_SOCIETY_MISMATCH', message: 'Resident does not belong to this society' });
    }
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { residentId: resident.id, societyId };
    const [data, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        select: {
          id: true, courierName: true, trackingNumber: true,
          description: true, photoUrl: true, arrivedAt: true,
          collectedAt: true, status: true, createdAt: true,
        },
        orderBy: { arrivedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.package.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findBySociety(societyId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { societyId };
    const [data, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        select: {
          id: true, courierName: true, trackingNumber: true,
          description: true, photoUrl: true, arrivedAt: true,
          collectedAt: true, status: true, createdAt: true,
          resident: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
              flat: { select: { id: true, number: true, floor: true } },
            },
          },
        },
        orderBy: { arrivedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.package.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async markCollected(packageId: string, societyId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND', message: 'Package not found' });
    if (pkg.societyId !== societyId) {
      throw new ForbiddenException({ code: 'PACKAGE_SOCIETY_MISMATCH', message: 'Package belongs to another society' });
    }
    return this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'COLLECTED', collectedAt: new Date() },
    });
  }
}
