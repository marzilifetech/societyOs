import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateVendorDto, UpdateVendorDto, VendorCategory } from './dto/create-vendor.dto';
import { CreateVendorOrderDto, UpdateVendorOrderStatusDto } from './dto/create-order.dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);
  constructor(private prisma: PrismaService) {}

  // ── Vendor CRUD ───────────────────────────────────────────────────────────────

  async listVendors(societyId: string, category?: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where: any = {
      societyId,
      isActive: true,
      ...(category ? { category: category as any } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        select: {
          id: true, name: true, category: true, phone: true,
          logoUrl: true, isActive: true, createdAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async getVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async createVendor(societyId: string, dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: { societyId, ...dto, isActive: dto.isActive ?? true },
    });
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    await this.getVendor(id);
    return this.prisma.vendor.update({ where: { id }, data: dto as any });
  }

  async softDeleteVendor(id: string) {
    await this.getVendor(id);
    return this.prisma.vendor.update({ where: { id }, data: { isActive: false } });
  }

  // ── Orders ────────────────────────────────────────────────────────────────────

  async placeOrder(vendorId: string, userId: string, societyId: string, dto: CreateVendorOrderDto) {
    await this.getVendor(vendorId);
    const resident = await requireResidentByUserId(this.prisma, userId);

    const totalAmount = dto.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    return this.prisma.vendorOrder.create({
      data: {
        vendorId,
        residentId: resident.id,
        societyId,
        items: dto.items as any,
        totalAmount,
        status: 'PENDING',
        notes: dto.notes,
        deliveryAt: dto.deliveryAt ? new Date(dto.deliveryAt) : undefined,
      },
    });
  }

  async myOrders(userId: string, page = 1, limit = 20) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { residentId: resident.id };
    const [data, total] = await Promise.all([
      this.prisma.vendorOrder.findMany({
        where,
        select: {
          id: true, status: true, totalAmount: true, items: true,
          notes: true, deliveryAt: true, createdAt: true,
          vendor: { select: { id: true, name: true, category: true, logoUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vendorOrder.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async allOrders(societyId: string, status?: string, vendorId?: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where: any = {
      societyId,
      ...(status ? { status: status as any } : {}),
      ...(vendorId ? { vendorId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vendorOrder.findMany({
        where,
        select: {
          id: true, status: true, totalAmount: true, items: true,
          notes: true, deliveryAt: true, createdAt: true,
          vendor: { select: { id: true, name: true, category: true } },
          resident: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
              flat: { select: { id: true, number: true, floor: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vendorOrder.count({ where }),
    ]);
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async updateOrderStatus(id: string, dto: UpdateVendorOrderStatusDto) {
    const order = await this.prisma.vendorOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.vendorOrder.update({ where: { id }, data: { status: dto.status as any } });
  }
}
