import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures a leave row exists, belongs to the admin's society, and can still be approved/rejected.
 */
export async function requireLeavePendingInSociety(
  prisma: PrismaService,
  leaveId: string,
  societyId: string,
) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { staff: true },
  });
  if (!leave) throw new NotFoundException('Leave request not found');
  if (leave.staff.societyId !== societyId) {
    throw new ForbiddenException({ code: 'LEAVE_SOCIETY_MISMATCH', message: 'Leave belongs to another society' });
  }
  if (leave.status !== LeaveStatus.PENDING) {
    throw new ConflictException({
      code: 'LEAVE_ALREADY_DECIDED',
      message: `Leave is already ${leave.status}`,
      currentStatus: leave.status,
    });
  }
  return leave;
}
