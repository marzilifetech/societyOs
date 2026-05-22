import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateFamilyMemberDto, UpdateFamilyMemberDto } from './dto/family-member.dto';

@Injectable()
export class FamilyMemberService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFamilyMemberDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.familyMember.create({
      data: {
        residentId: resident.id,
        name: dto.name,
        phone: dto.phone,
        relationship: dto.relationship,
        permissions: (dto.permissions ?? {}) as any,
        isVerified: false,
      },
    });
  }

  async findAll(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.familyMember.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, userId: string, dto: UpdateFamilyMemberDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const member = await this.prisma.familyMember.findUnique({ where: { id } });
    if (!member || member.residentId !== resident.id) throw new NotFoundException('Family member not found');

    return this.prisma.familyMember.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.relationship && { relationship: dto.relationship }),
        ...(dto.permissions && { permissions: dto.permissions as any }),
      },
    });
  }

  async remove(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const member = await this.prisma.familyMember.findUnique({ where: { id } });
    if (!member || member.residentId !== resident.id) throw new NotFoundException('Family member not found');
    return this.prisma.familyMember.delete({ where: { id } });
  }
}
