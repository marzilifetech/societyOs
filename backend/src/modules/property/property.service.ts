import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';

@Injectable()
export class PropertyService {
  constructor(private prisma: PrismaService) {}

  async getListings(societyId: string) {
    return this.prisma.propertyListing.findMany({
      where: { societyId, status: 'ACTIVE' },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListing(id: string) {
    const listing = await this.prisma.propertyListing.findUnique({
      where: { id },
      include: {
        resident: { include: { user: true, flat: true } },
        interests: { include: { resident: { include: { user: true } } } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async createListing(userId: string, societyId: string, dto: any) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.propertyListing.create({
      data: {
        societyId,
        residentId: resident.id,
        areaSqft: dto.areaSqft,
        price: dto.price,
        furnished: dto.furnished ?? false,
        description: dto.description,
        photos: dto.photos ?? [],
        status: 'ACTIVE',
      },
    });
  }

  async contactSeller(listingId: string, userId: string, message?: string) {
    const listing = await this.prisma.propertyListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'ACTIVE') throw new NotFoundException('Listing not found');

    const buyer = await requireResidentByUserId(this.prisma, userId);
    if (buyer.id === listing.residentId) {
      throw new ConflictException('Cannot contact your own listing');
    }

    try {
      return await this.prisma.propertyInterest.create({
        data: { listingId, residentId: buyer.id, message },
        include: { listing: { include: { resident: { include: { user: true } } } } },
      });
    } catch {
      throw new ConflictException('Already expressed interest in this listing');
    }
  }

  async getMyRental(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const listing = await this.prisma.propertyListing.findFirst({
      where: { residentId: resident.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!listing) return null;
    return {
      id: listing.id,
      rentAmount: Number(listing.price),
      availableFrom: listing.createdAt,
      furnished: listing.furnished,
      description: listing.description ?? undefined,
      status: listing.status,
      createdAt: listing.createdAt,
    };
  }

  async getMyListings(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.propertyListing.findMany({
      where: { residentId: resident.id },
      include: { interests: { include: { resident: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async closeListing(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const listing = await this.prisma.propertyListing.findUnique({ where: { id } });
    if (!listing || listing.residentId !== resident.id) throw new NotFoundException('Listing not found');
    return this.prisma.propertyListing.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }
}
