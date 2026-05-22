import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export async function findResidentByUserId(prisma: PrismaService, userId: string) {
  return prisma.resident.findUnique({
    where: { userId },
    include: { user: true, flat: true },
  });
}

export async function requireResidentByUserId(prisma: PrismaService, userId: string) {
  const resident = await findResidentByUserId(prisma, userId);

  if (!resident) {
    throw new NotFoundException('Resident profile not found');
  }

  return resident;
}
