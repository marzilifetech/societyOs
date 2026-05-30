import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../../common/notification/push.service';
import { UserStatus, UserRole, ComplaintStatus, TravelPauseStatus, InfrastructureType, InfrastructureStatus } from '@prisma/client';
import { requireLeavePendingInSociety } from '../../common/utils/leave-admin.util';
import { ComplianceService } from '../compliance/compliance.service';
import { AuditService } from '../../common/audit/audit.service';
import { parseCsv, rowToRecord, toCsvRow } from '../../common/utils/csv.util';
import { SocietySeederService } from '../society/society-seeder.service';
import { runWithTenantContext, getTenantContext } from '../../common/tenancy/tenant.context';
import { asyncPool } from '../../common/utils/async-pool';

// Concurrency ceiling for fan-out push delivery — keeps a 1k-resident society
// from saturating FCM rate limits while still finishing well under a minute.
const PUSH_CONCURRENCY = 25;

/** Valid admin-driven status moves (corner case SR2: no arbitrary jumps). */
const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.OPEN]: [ComplaintStatus.UNDER_REVIEW, ComplaintStatus.REJECTED],
  [ComplaintStatus.UNDER_REVIEW]: [ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED, ComplaintStatus.OPEN],
  [ComplaintStatus.RESOLVED]: [ComplaintStatus.CLOSED],
  [ComplaintStatus.REJECTED]: [ComplaintStatus.OPEN, ComplaintStatus.UNDER_REVIEW],
  [ComplaintStatus.CLOSED]: [],
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private push: PushService,
    private compliance: ComplianceService,
    private audit: AuditService,
    private societySeeder: SocietySeederService,
  ) {}

  async exportResidentDataAsAdmin(
    societyId: string,
    residentUserId: string,
    actor: { id: string; role: string },
    reason: string | undefined,
    ipAddress: string | undefined,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: residentUserId, societyId, role: UserRole.RESIDENT },
    });
    if (!target) throw new NotFoundException('Resident not found');

    const bundle = await this.compliance.dataExport(residentUserId, ipAddress ?? null);

    await this.audit.write({
      entityType: 'User',
      entityId: residentUserId,
      action: 'RESIDENT_DATA_EXPORTED',
      module: 'admin',
      actorId: actor.id,
      actorRole: actor.role,
      societyId,
      ipAddress: ipAddress ?? null,
      after: { reason: reason ?? null },
    });

    return bundle;
  }

  async getSociety(societyId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    return society;
  }

  async updateSociety(
    societyId: string,
    dto: {
      name?: string;
      address?: string;
      city?: string;
      pincode?: string;
      contactEmail?: string;
      contactPhone?: string;
      showInDirectory?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.pincode !== undefined) data.pincode = dto.pincode;
    if (dto.showInDirectory !== undefined) data.showInDirectory = dto.showInDirectory;

    // Merge nested config rather than overwrite to avoid losing other keys.
    const existingConfig = (society.config as Record<string, unknown> | null) ?? {};
    const nextConfig: Record<string, unknown> = { ...existingConfig };
    if (dto.contactEmail !== undefined) nextConfig.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) nextConfig.contactPhone = dto.contactPhone;
    if (dto.config && typeof dto.config === 'object') {
      Object.assign(nextConfig, dto.config);
    }
    if (
      dto.contactEmail !== undefined ||
      dto.contactPhone !== undefined ||
      (dto.config && typeof dto.config === 'object')
    ) {
      data.config = nextConfig;
    }

    return this.prisma.society.update({ where: { id: societyId }, data });
  }

  async getDashboardStats(societyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalResidents,
      totalStaff,
      openServiceRequests,
      pendingComplaints,
      todayVisitors,
      overdueMaintenanceBills,
      activeAlerts,
      totalFlats,
      occupiedFlats,
    ] = await Promise.all([
      this.prisma.resident.count({ where: { user: { societyId, status: 'ACTIVE' } } }),
      this.prisma.staffMember.count({ where: { societyId } }),
      this.prisma.serviceRequest.count({
        where: { societyId, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
      this.prisma.complaint.count({ where: { societyId, status: 'OPEN' } }),
      this.prisma.visitor.count({
        where: { resident: { flat: { societyId } }, createdAt: { gte: today } },
      }),
      this.prisma.maintenanceBill.count({
        where: { flat: { societyId }, status: 'FAILED' },
      }),
      this.prisma.sosAlert.count({ where: { societyId, status: 'ACTIVE' } }),
      this.prisma.flat.count({ where: { societyId } }),
      this.prisma.flat.count({ where: { societyId, residents: { some: {} } } }),
    ]);

    const occupancyRate = totalFlats > 0 ? Math.round((occupiedFlats / totalFlats) * 100) : 0;

    return {
      totalResidents,
      totalStaff,
      openServiceRequests,
      pendingComplaints,
      todayVisitors,
      overdueMaintenanceBills,
      activeAlerts,
      occupancyRate,
    };
  }

  async getResidents(societyId: string, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length ? { flat: { block: { in: managedBlocks } } } : {};
    const residents = await this.prisma.resident.findMany({
      where: { user: { societyId }, deletedAt: null, ...blockWhere },
      include: { user: true, flat: true },
      orderBy: { createdAt: 'desc' },
    });
    return residents.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      phone: r.user.phone,
      email: r.user.email,
      status: r.user.status,
      type: r.type,
      flat: r.flat ? { id: r.flat.id, block: r.flat.block, number: r.flat.number, floor: r.flat.floor } : null,
      unit: { flatNumber: r.flat?.number, tower: r.flat?.block },
      moveInDate: r.moveInDate,
      moveOutDate: r.moveOutDate,
      dateOfBirth: (r as any).dateOfBirth ?? null,
      roleNote: (r as any).roleNote ?? null,
      appActivatedAt: (r as any).appActivatedAt ?? null,
      emergencyContact: r.emergencyContact ?? null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Accepts either a userId or a residentId — the admin-web list returns
   * userId-as-`id`, but the detail page uses residentId. Rather than force
   * a frontend migration, resolve both shapes here.
   *
   * MUST validate that the resolved User belongs to the caller's society —
   * without this, any admin (regular or SUPER_ADMIN with a stale tenant
   * switch) could approve/reject a User from another society by knowing the
   * id. User is in `CROSS_TENANT_MODELS` so the Prisma tenant extension does
   * NOT auto-scope it; the scope must be hand-rolled here.
   */
  private async resolveUserIdFromResidentish(
    societyId: string,
    idOrResidentId: string,
  ): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: idOrResidentId, societyId },
      select: { id: true },
    });
    if (user) return user.id;
    // Fall back to treating the id as a residentId — assert society via the
    // related User row, which has the canonical societyId column.
    const resident = await this.prisma.resident.findFirst({
      where: { id: idOrResidentId, user: { societyId } },
      select: { userId: true },
    });
    if (!resident) throw new NotFoundException('Resident not found in this society');
    return resident.userId;
  }

  async approveResident(societyId: string, idOrResidentId: string) {
    const userId = await this.resolveUserIdFromResidentish(societyId, idOrResidentId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
    if (user.fcmToken) {
      await this.notificationService.sendToToken(user.fcmToken, {
        title: 'Welcome to the Society!',
        body: 'Your account has been approved. You can now access all resident features.',
        data: { type: 'RESIDENT_APPROVED' },
      });
    }
    return user;
  }

  async rejectResident(societyId: string, idOrResidentId: string, reason: string) {
    const userId = await this.resolveUserIdFromResidentish(societyId, idOrResidentId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.REJECTED, adminNote: reason },
    });
    if (user.fcmToken) {
      await this.notificationService.sendToToken(user.fcmToken, {
        title: 'Registration Update',
        body: `Your resident registration was not approved. Reason: ${reason}. Please contact society office.`,
        data: { type: 'RESIDENT_REJECTED', reason },
      });
    }
    return user;
  }

  async getPendingResidents(societyId: string, managedBlocks?: string[]) {
    const blockWhere = managedBlocks?.length ? { flat: { block: { in: managedBlocks } } } : {};
    const residents = await this.prisma.resident.findMany({
      where: { user: { societyId, status: 'PENDING' }, ...blockWhere },
      include: { user: true, flat: true },
      orderBy: { createdAt: 'desc' },
    });
    return residents.map((r) => ({
      id: r.userId,
      residentId: r.id,
      name: r.user.name,
      phone: r.user.phone,
      email: r.user.email,
      status: r.user.status,
      adminNote: r.user.adminNote,
      flat: r.flat ? { id: r.flat.id, block: r.flat.block, number: r.flat.number, floor: r.flat.floor } : null,
      type: r.type,
      idProof: r.idProof,
      addressProof: r.addressProof,
      documentsStatus: r.documentsStatus,
      createdAt: r.createdAt,
    }));
  }

  async getStaff(societyId: string) {
    const staff = await this.prisma.staffMember.findMany({
      where: { societyId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return staff.map((sm) => ({
      id: sm.id,
      name: sm.user.name,
      phone: sm.user.phone,
      role: sm.designation,
      designation: sm.designation,
      department: sm.department ?? null,
      categories: sm.categories,
      joiningDate: sm.joiningDate,
      leavingDate: sm.leavingDate ?? null,
      createdAt: sm.createdAt,
    }));
  }

  async getLeaves(societyId: string, status?: string) {
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        staff: { societyId },
        ...(status ? { status: status as any } : {}),
      },
      include: { staff: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return leaves.map((leave) => ({
      id: leave.id,
      leaveType: leave.type,
      fromDate: leave.startDate,
      toDate: leave.endDate,
      reason: leave.reason,
      status: leave.status,
      adminNote: leave.adminNote,
      staff: { id: leave.staff.id, name: leave.staff.user.name, role: leave.staff.designation },
      staffId: leave.staff.id,
      createdAt: leave.createdAt,
    }));
  }

  async approveLeave(leaveId: string, societyId: string, adminNote?: string) {
    const leave = await requireLeavePendingInSociety(this.prisma, leaveId, societyId);
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'APPROVED', ...(adminNote ? { adminNote } : {}) },
    });

    const resignationTypes = ['RESIGNATION', 'TERMINATION', 'EMERGENCY', 'LEAVE_REQUESTED'];
    if (resignationTypes.includes(leave.type?.toUpperCase?.() ?? leave.type)) {
      // requireLeavePendingInSociety above already pinned the leave to this society,
      // so dismissStaff's composite WHERE will resolve the same tenant.
      await this.dismissStaff(societyId, leave.staffId);
    }

    return updated;
  }

  async rejectLeave(leaveId: string, societyId: string, adminNote?: string) {
    await requireLeavePendingInSociety(this.prisma, leaveId, societyId);
    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'REJECTED', ...(adminNote ? { adminNote } : {}) },
    });
  }

  async getVisitors(societyId: string, status?: string, date?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visitors = await this.prisma.visitor.findMany({
      where: {
        resident: { flat: { societyId } },
        ...(status ? { status: status as any } : {}),
        ...(date === 'today' ? { createdAt: { gte: today } } : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return visitors.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      purpose: v.purpose,
      vehicleNumber: v.vehicleNo,
      status: v.status === 'EXPECTED' ? 'PENDING' : v.status,
      approvalStatus: v.approvalStatus,
      validFrom: v.validFrom,
      validTill: v.validUntil,
      qrToken: v.qrToken,
      checkedInAt: v.entryAt,
      checkedOutAt: v.exitAt,
      resident: {
        name: v.resident.user.name,
        unit: { flatNumber: v.resident.flat?.number, tower: v.resident.flat?.block },
      },
      createdAt: v.createdAt,
    }));
  }

  async getComplaints(societyId: string, status?: string) {
    const rows = await this.prisma.complaint.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      include: {
        resident: { include: { user: true, flat: true } },
        assignedTo: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c: any) => ({
      ...c,
      assignedTo: c.assignedTo
        ? { id: c.assignedTo.id, name: c.assignedTo.user?.name ?? null }
        : null,
    }));
  }

  async updateComplaintStatus(id: string, societyId: string, status: string, adminNote?: string) {
    const allowedEnums = Object.values(ComplaintStatus) as string[];
    if (!allowedEnums.includes(status)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Invalid complaint status: ${status}`,
        allowed: allowedEnums,
      });
    }
    const next = status as ComplaintStatus;
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.societyId !== societyId) {
      throw new ForbiddenException({ code: 'COMPLAINT_SOCIETY_MISMATCH', message: 'Complaint belongs to another society' });
    }

    const current = complaint.status;
    if (current === next) {
      return this.prisma.complaint.update({
        where: { id },
        data: { ...(adminNote ? { adminNote } : {}) },
      });
    }

    const allowed = COMPLAINT_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new ConflictException({
        code: 'INVALID_COMPLAINT_TRANSITION',
        message: `Cannot move complaint from ${current} to ${next}`,
        from: current,
        to: next,
        allowedNext: allowed,
      });
    }

    const data: Record<string, unknown> = { status: next, ...(adminNote ? { adminNote } : {}) };
    if (next === ComplaintStatus.RESOLVED || next === ComplaintStatus.CLOSED) {
      data.resolvedAt = new Date();
    } else {
      data.resolvedAt = null;
    }

    return this.prisma.complaint.update({
      where: { id },
      data: data as any,
    });
  }

  async assignComplaint(id: string, societyId: string, staffId: string, _staffName?: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.societyId !== societyId) {
      throw new ForbiddenException({ code: 'COMPLAINT_SOCIETY_MISMATCH', message: 'Complaint belongs to another society' });
    }
    // Verify staff exists in this society — defense against cross-tenant
    // assignment via a stale or guessed staffId.
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      include: { user: { select: { name: true } } },
    });
    if (!staff) {
      throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: 'Staff not found in this society' });
    }
    // H1: write a real assignedToId — never clobber adminNote (admins use
    // that for free-text resolution context).
    const statusUpdate = complaint.status === 'OPEN' ? { status: 'UNDER_REVIEW' as any } : {};
    return this.prisma.complaint.update({
      where: { id },
      data: { assignedToId: staffId, ...statusUpdate },
      include: {
        assignedTo: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  }

  async getMaintenanceBills(societyId: string, year?: number, month?: number) {
    const where: any = { flat: { societyId } };
    if (year && month) {
      where.period = `${year}-${String(month).padStart(2, '0')}`;
    }
    const bills = await this.prisma.maintenanceBill.findMany({
      where,
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { dueDate: 'asc' },
    });
    return bills.map((bill) => ({
      id: bill.id,
      period: bill.period,
      amount: Number(bill.total),
      dueDate: bill.dueDate,
      status:
        bill.status === 'SUCCESS'
          ? 'PAID'
          : bill.status === 'FAILED'
          ? 'OVERDUE'
          : bill.status === 'WAIVED'
          ? 'WAIVED'
          : 'PENDING',
      paymentMethod: (bill as any).paymentMethod ?? null,
      resident: {
        name: bill.resident.user.name,
        unit: { flatNumber: bill.resident.flat?.number, tower: bill.resident.flat?.block },
      },
      createdAt: bill.createdAt,
    }));
  }

  async sendPaymentReminder(billId: string, societyId: string) {
    const bill = await this.prisma.maintenanceBill.findUnique({
      where: { id: billId },
      include: { flat: true, resident: { include: { user: true } } },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'BILL_SOCIETY_MISMATCH', message: 'Bill belongs to another society' });
    }
    if (bill.status === 'SUCCESS') {
      return { sent: false, billId, reason: 'already_paid', channel: 'none' as const };
    }

    const uid = bill.resident.user.id;
    const result = await this.push.send(
      uid,
      {
        title: 'Payment Reminder',
        body: `Your maintenance bill of ₹${Number(bill.total)} for ${bill.period} is due on ${bill.dueDate.toDateString()}.`,
        category: 'billing',
      },
      { billId: String(billId) },
    );

    if (!result.ok) {
      this.logger.warn(`payment reminder bill=${billId} user=${uid} reason=${result.reason ?? 'unknown'}`);
    }

    // Non-critical billing: in-app / ops follow-up when push deferred, opted out, or missing token
    return {
      sent: result.ok,
      billId,
      reason: result.reason,
      channel: result.ok ? 'push' : 'none',
      note:
        result.reason === 'queued_quiet_hours'
          ? 'Notification queued for after quiet hours'
          : result.reason === 'opted_out'
            ? 'Resident opted out of billing pushes; use another channel if required'
            : result.reason === 'no_token'
              ? 'No FCM token on file'
              : undefined,
    };
  }

  async markBillFailed(billId: string, reason?: string) {
    const bill = await this.prisma.maintenanceBill.findUnique({ where: { id: billId } });
    if (!bill) throw new NotFoundException('Bill not found');
    return this.prisma.maintenanceBill.update({
      where: { id: billId },
      data: { status: 'FAILED' },
    });
  }

  private async computeTravelPauseCredit(residentId: string, year: number, month: number, baseAmount: number): Promise<{ credit: number; days: number }> {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);
    const daysInMonth = (periodEnd.getTime() - periodStart.getTime()) / 86_400_000;

    const pauses = await this.prisma.travelPause.findMany({
      where: {
        residentId,
        status: { in: [TravelPauseStatus.ACTIVE, TravelPauseStatus.COMPLETED] },
        startDate: { lt: periodEnd },
        returnDate: { gt: periodStart },
      },
    });

    return this.computeCreditFromPauses(pauses, periodStart, periodEnd, daysInMonth, baseAmount);
  }

  /** Pure helper: sum overlap of pauses with the period and convert to credit. */
  private computeCreditFromPauses(
    pauses: Array<{ startDate: Date; returnDate: Date }>,
    periodStart: Date,
    periodEnd: Date,
    daysInMonth: number,
    baseAmount: number,
  ): { credit: number; days: number } {
    let pausedMs = 0;
    for (const p of pauses) {
      const start = p.startDate < periodStart ? periodStart : p.startDate;
      const end = p.returnDate > periodEnd ? periodEnd : p.returnDate;
      pausedMs += Math.max(0, end.getTime() - start.getTime());
    }
    const pausedDays = Math.round(pausedMs / 86_400_000);
    const credit = baseAmount > 0 ? Math.round((pausedDays / daysInMonth) * baseAmount * 100) / 100 : 0;
    return { credit, days: pausedDays };
  }

  async generateBills(societyId: string, year: number, month: number) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const dueDate = new Date(year, month - 1, 28);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);
    const daysInMonth = (periodEnd.getTime() - periodStart.getTime()) / 86_400_000;

    const flats = await this.prisma.flat.findMany({
      where: { societyId },
      include: { residents: true },
    });

    const residentIds = flats.flatMap((f) => f.residents.map((r) => r.id));

    // Pre-fetch all relevant travel pauses ONCE — was O(residents) queries
    // due to per-resident computeTravelPauseCredit calls.
    const allPauses = residentIds.length
      ? await this.prisma.travelPause.findMany({
          where: {
            residentId: { in: residentIds },
            status: { in: [TravelPauseStatus.ACTIVE, TravelPauseStatus.COMPLETED] },
            startDate: { lt: periodEnd },
            returnDate: { gt: periodStart },
          },
          select: { residentId: true, startDate: true, returnDate: true },
        })
      : [];

    const pausesByResident = new Map<string, Array<{ startDate: Date; returnDate: Date }>>();
    for (const p of allPauses) {
      const list = pausesByResident.get(p.residentId) ?? [];
      list.push({ startDate: p.startDate, returnDate: p.returnDate });
      pausesByResident.set(p.residentId, list);
    }

    const existingBills = await this.prisma.maintenanceBill.findMany({
      where: { flat: { societyId }, period },
      select: { flatId: true, residentId: true },
    });
    const existingKeys = new Set(existingBills.map((b) => `${b.flatId}:${b.residentId}`));

    const toCreate: any[] = [];
    for (const flat of flats) {
      for (const resident of flat.residents) {
        const key = `${flat.id}:${resident.id}`;
        if (existingKeys.has(key)) continue;
        const baseAmount = 0; // base amount set by society config; credit computed when non-zero
        const { credit: travelPauseCredit, days: pausedDays } = this.computeCreditFromPauses(
          pausesByResident.get(resident.id) ?? [],
          periodStart,
          periodEnd,
          daysInMonth,
          baseAmount,
        );
        const breakdown: Record<string, any> = {};
        if (pausedDays > 0) {
          breakdown.travelPauseCredit = travelPauseCredit;
          breakdown.pausedDays = pausedDays;
        }
        toCreate.push({
          flatId: flat.id,
          residentId: resident.id,
          period,
          breakdown,
          total: Math.max(0, baseAmount - travelPauseCredit),
          dueDate,
          status: 'PENDING',
        });
      }
    }

    // Atomic: if createMany fails halfway we don't want a partial month of
    // bills. Wrap the (single) write in $transaction for forward-compat with
    // any additional writes we may need to add to bill generation.
    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.maintenanceBill.createMany({ data: toCreate });
      });
    }

    return { created: toCreate.length, period };
  }

  async getAdminEvents(societyId: string) {
    const events = await this.prisma.event.findMany({
      where: { societyId },
      include: { _count: { select: { registrations: true } } },
      orderBy: { date: 'asc' },
    });
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category ?? 'OTHER',
      startAt: event.date,
      endAt: new Date(event.date.getTime() + 2 * 60 * 60 * 1000),
      venue: event.venue,
      maxAttendees: event.capacity,
      registeredCount: event._count.registrations,
      status: event.status,
      createdAt: event.createdAt,
    }));
  }

  async createEvent(societyId: string, dto: any) {
    return this.prisma.event.create({
      data: {
        societyId,
        title: dto.title,
        description: dto.description,
        date: new Date(dto.startAt),
        venue: dto.venue ?? 'Community Hall',
        capacity: dto.maxAttendees,
        status: 'PUBLISHED',
      },
    });
  }

  async cancelEventAdmin(societyId: string, id: string) {
    return this.prisma.event.update({
      where: { id, societyId },
      data: { status: 'CANCELLED' },
    });
  }

  async updateEventAdmin(societyId: string, id: string, dto: any) {
    const event = await this.prisma.event.findFirst({ where: { id, societyId } });
    if (!event) throw new NotFoundException('Event not found');

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.venue !== undefined) data.venue = dto.venue;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.maxAttendees !== undefined) {
      data.capacity =
        dto.maxAttendees === null || dto.maxAttendees === ''
          ? null
          : Number(dto.maxAttendees);
    } else if (dto.capacity !== undefined) {
      data.capacity = dto.capacity;
    }
    if (dto.startAt !== undefined) data.date = new Date(dto.startAt);
    else if (dto.date !== undefined) data.date = new Date(dto.date);

    return this.prisma.event.update({ where: { id }, data });
  }

  async deleteEventAdmin(societyId: string, id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, societyId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.eventRegistration.deleteMany({ where: { eventId: id } });
    return this.prisma.event.delete({ where: { id } });
  }

  async getEventAttendees(eventId: string) {
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { registeredAt: 'asc' },
    });

    return registrations.map((r) => ({
      id: r.id,
      flatNumber: r.resident?.flat
        ? `${r.resident.flat.block}-${r.resident.flat.number}`
        : null,
      name: r.resident?.user?.name ?? null,
      phone: r.resident?.user?.phone ?? null,
      registeredAt: r.registeredAt,
      waitlisted: r.waitlisted,
    }));
  }

  async notifyEventRegistrants(societyId: string, eventId: string, message: string) {
    if (!message || !message.trim()) {
      throw new BadRequestException('Message is required');
    }
    const event = await this.prisma.event.findFirst({ where: { id: eventId, societyId } });
    if (!event) throw new NotFoundException('Event not found');

    const regs = await this.prisma.eventRegistration.findMany({
      where: { eventId, waitlisted: false },
      include: { resident: { include: { user: true } } },
    });

    let pushed = 0;
    await Promise.all(
      regs.map(async (r) => {
        const userId = r.resident?.user?.id;
        if (!userId) return;
        try {
          const res = await this.push.send(
            userId,
            {
              title: `Update: ${event.title}`,
              body: message,
              category: 'events',
            },
            { type: 'EVENT_NOTIFY', eventId },
          );
          if (res.ok) pushed += 1;
        } catch (err) {
          this.logger.warn(
            `notifyEventRegistrants: push failed for user ${userId}: ${(err as Error).message}`,
          );
        }
      }),
    );

    return { sent: true, recipients: regs.length, pushed };
  }

  async getEventFeedback(societyId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, societyId } });
    if (!event) throw new NotFoundException('Event not found');

    const reviews = await this.prisma.eventFeedback.findMany({
      where: { eventId },
      include: { resident: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const reviewCount = reviews.length;
    const avgRating =
      reviewCount === 0
        ? null
        : reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviewCount;

    return {
      reviewCount,
      avgRating,
      reviews: reviews.map((r) => ({
        rating: Number(r.rating),
        comment: r.comment,
        residentName: r.resident?.user?.name ?? 'Anonymous',
        createdAt: r.createdAt,
      })),
    };
  }

  async createHoliday(
    societyId: string,
    dto: { date: string; name: string; isOptional?: boolean },
  ) {
    return this.prisma.holiday.create({
      data: {
        societyId,
        date: new Date(dto.date),
        name: dto.name,
        isOptional: dto.isOptional ?? false,
      },
    });
  }

  async getMaintenanceReport(societyId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const start = new Date(`${y}-01-01T00:00:00.000Z`);
    const end = new Date(`${y + 1}-01-01T00:00:00.000Z`);
    const now = new Date();

    const bills = await this.prisma.maintenanceBill.findMany({
      where: { flat: { societyId }, dueDate: { gte: start, lt: end } },
      include: { payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 1 } },
    });

    let totalBilled = 0, totalCollected = 0;
    const aging = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
    const monthMap: Record<string, { billed: number; collected: number }> = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthMap[key] = { billed: 0, collected: 0 };
    }

    for (const bill of bills) {
      const amount = Number(bill.total);
      totalBilled += amount;

      const monthKey = bill.period.substring(0, 7);
      if (monthMap[monthKey]) {
        monthMap[monthKey].billed += amount;
      }

      if (bill.status === 'SUCCESS') {
        totalCollected += amount;
        if (monthMap[monthKey]) {
          monthMap[monthKey].collected += amount;
        }
      } else if (bill.status === 'PENDING' || bill.status === 'FAILED') {
        const daysOverdue = Math.floor((now.getTime() - bill.dueDate.getTime()) / 86_400_000);
        if (daysOverdue <= 0) aging.current += amount;
        else if (daysOverdue <= 30) aging.current += amount;
        else if (daysOverdue <= 60) aging.overdue30 += amount;
        else if (daysOverdue <= 90) aging.overdue60 += amount;
        else aging.overdue90 += amount;
      }
    }

    const totalOutstanding = totalBilled - totalCollected;

    return {
      summary: { totalBilled, totalCollected, totalOutstanding },
      agingBuckets: {
        current: aging.current,
        overdue30: aging.overdue30,
        overdue60: aging.overdue60,
        overdue90: aging.overdue90,
      },
      monthlyTrend: Object.entries(monthMap).map(([month, data]) => ({ month, ...data })),
    };
  }

  async exportMaintenanceReportCsv(societyId: string, year?: number, status?: string): Promise<string> {
    const where: any = { flat: { societyId } };
    if (year) {
      const start = new Date(`${year}-01-01T00:00:00.000Z`);
      const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      where.dueDate = { gte: start, lt: end };
    }
    if (status) {
      where.status = status === 'OVERDUE' ? 'FAILED' : status;
    }

    const bills = await this.prisma.maintenanceBill.findMany({
      where,
      include: {
        resident: { include: { user: true, flat: true } },
        payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 1 },
      },
      orderBy: { dueDate: 'asc' },
    });

    const header = 'Resident,Unit,Amount,Status,DueDate,PaidDate\n';
    const body = bills
      .map((bill) => {
        const name = bill.resident.user.name ?? '';
        const unit = bill.resident.flat
          ? `${bill.resident.flat.block ?? ''}-${bill.resident.flat.number ?? ''}`
          : '';
        const amount = Number(bill.total).toFixed(2);
        const isOverdue = bill.status === 'PENDING' && bill.dueDate < new Date();
        const billStatus = status === 'OVERDUE' || bill.status === 'FAILED' ? 'OVERDUE' : isOverdue ? 'OVERDUE' : bill.status === 'SUCCESS' ? 'PAID' : bill.status;
        const dueDate = bill.dueDate.toISOString().split('T')[0];
        const paidDate = bill.payments[0]?.paidAt?.toISOString().split('T')[0] ?? '';
        return [
          `"${name.replace(/"/g, '""')}"`,
          `"${unit}"`,
          amount,
          billStatus,
          dueDate,
          paidDate,
        ].join(',');
      })
      .join('\n');

    return header + body;
  }

  async getHolidays(societyId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    return this.prisma.holiday.findMany({
      where: { societyId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

async createStaff(
    societyId: string,
    dto: {
      phone: string;
      name: string;
      designation: string;
      department?: string;
      categories: string[];
      salary?: number;
      gender?: string;
      dateOfBirth?: string;
      emergencyContact?: { name: string; phone: string; relation?: string };
    },
  ) {
    const phone = dto.phone.trim();
    const existing = await this.prisma.user.findFirst({ where: { phone, societyId } });

    if (existing) {
      const existingStaff = await this.prisma.staffMember.findUnique({ where: { userId: existing.id } });
      if (existingStaff) {
        throw new ConflictException('Staff member with this phone already exists in this society');
      }
      throw new ConflictException('Phone number is already registered in this society');
    }

    const user = await this.prisma.user.create({
      data: {
        phone,
        name: dto.name.trim(),
        role: 'STAFF',
        status: 'ACTIVE',
        societyId,
        ...(dto.gender ? { gender: dto.gender } : {}),
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      } as any,
    });

    return this.prisma.staffMember.create({
      data: {
        userId: user.id,
        societyId,
        designation: dto.designation,
        department: dto.department,
        categories: dto.categories,
        salaryStructure: dto.salary ? { base: dto.salary } : undefined,
        joiningDate: new Date(),
        ...(dto.emergencyContact ? { emergencyContact: dto.emergencyContact as any } : {}),
      },
      include: { user: true },
    });
  }

  /**
   * Cross-society staff transfer (SUPER_ADMIN only — gated at controller).
   *
   * Hardens the previous wide-open implementation:
   *   1. Verifies the staff member lives in the caller's source society.
   *   2. Verifies the destination society exists AND is ACTIVE (cannot
   *      transfer into SUSPENDED/ARCHIVED).
   *   3. Wraps both row updates in a transaction so a partial transfer
   *      (staff in society B, user still in society A) cannot persist.
   *   4. Writes an audit entry with before/after societyId for traceability.
   */
  async transferStaff(
    staffId: string,
    fromSocietyId: string,
    toSocietyId: string,
    actor: { id: string; role: string },
    reason?: string,
  ) {
    if (toSocietyId === fromSocietyId) {
      throw new BadRequestException({
        code: 'TRANSFER_NOOP',
        message: 'Source and destination societies are identical',
      });
    }

    const staff = await this.prisma.staffMember.findUnique({
      where: { id: staffId },
      select: { id: true, userId: true, societyId: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.societyId !== fromSocietyId) {
      throw new ForbiddenException({
        code: 'STAFF_SOCIETY_MISMATCH',
        message: 'Staff member does not belong to the source society',
      });
    }

    const target = await this.prisma.society.findUnique({
      where: { id: toSocietyId },
      select: { id: true, status: true },
    });
    if (!target) {
      throw new NotFoundException({ code: 'TARGET_SOCIETY_NOT_FOUND', message: 'Target society does not exist' });
    }
    if (target.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'TARGET_SOCIETY_INACTIVE',
        message: `Target society is ${target.status} — cannot transfer staff`,
      });
    }

    await this.prisma.$transaction([
      this.prisma.staffMember.update({
        where: { id: staffId },
        data: { societyId: toSocietyId },
      }),
      this.prisma.user.update({
        where: { id: staff.userId },
        data: { societyId: toSocietyId },
      }),
    ]);

    await this.audit.write({
      entityType: 'StaffMember',
      entityId: staffId,
      action: 'STAFF_TRANSFERRED',
      module: 'admin',
      actorId: actor.id,
      actorRole: actor.role,
      societyId: fromSocietyId,
      before: { societyId: fromSocietyId },
      after: { societyId: toSocietyId, reason: reason ?? null },
    });

    return { success: true, message: 'Staff transferred successfully' };
  }

  async deactivateStaff(staffId: string, societyId: string) {
    // Tenant scope: prisma.staffMember.findUnique is NOT auto-scoped by the
    // tenant extension (it skips findUnique/update/delete). Caller passes
    // their own societyId; we reject any staff record from a different one.
    const staff = await this.prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.societyId !== societyId) {
      throw new ForbiddenException({ code: 'CROSS_TENANT_ACCESS' });
    }

    await this.prisma.user.update({
      where: { id: staff.userId },
      data: { status: UserStatus.INACTIVE },
    });

    return { success: true, message: 'Staff deactivated successfully' };
  }

  async getStaffDetail(staffId: string, societyId: string) {
    // Tenant scope — see deactivateStaff for the rationale.
    const staff = await this.prisma.staffMember.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.societyId !== societyId) {
      throw new ForbiddenException({ code: 'CROSS_TENANT_ACCESS' });
    }

    const pendingLoansCount = await this.prisma.staffLoan.count({
      where: { staffMemberId: staffId, status: 'PENDING' },
    });

    const user = staff.user;
    return {
      id: staff.id,
      name: user.name,
      phone: user.phone,
      gender: (user as any).gender ?? null,
      dateOfBirth: (user as any).dateOfBirth ?? null,
      role: staff.designation,
      designation: staff.designation,
      department: staff.department ?? null,
      categories: staff.categories,
      salary: staff.salaryStructure && typeof staff.salaryStructure === 'object' ? (staff.salaryStructure as any).base : null,
      salaryStructure: staff.salaryStructure ?? null,
      joiningDate: staff.joiningDate,
      leavingDate: staff.leavingDate ?? null,
      familyDetails: staff.familyDetails ?? null,
      emergencyContact: (staff as any).emergencyContact ?? null,
      pendingLoansCount,
    };
  }

  async updateStaff(
    societyId: string,
    staffId: string,
    body: {
      salaryStructure?: Record<string, any>;
      department?: string;
      designation?: string;
      leavingDate?: string | null;
      familyDetails?: any;
      gender?: string;
      dateOfBirth?: string | null;
      emergencyContact?: { name: string; phone: string; relation?: string } | null;
    },
  ) {
    // Composite (id, societyId) WHERE — defends against SUPER_ADMIN bypass
    // because the WHERE is in `args` and applied by Prisma regardless of
    // tenant.extension short-circuit.
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    const staffData: any = {};
    const userData: any = {};

    if (body.salaryStructure !== undefined) {
      const existing = (staff.salaryStructure && typeof staff.salaryStructure === 'object') ? staff.salaryStructure as Record<string, any> : {};
      staffData.salaryStructure = { ...existing, ...body.salaryStructure };
    }
    if (body.department !== undefined) staffData.department = body.department;
    if (body.designation !== undefined) staffData.designation = body.designation;
    if (body.leavingDate !== undefined) staffData.leavingDate = body.leavingDate ? new Date(body.leavingDate) : null;
    if (body.familyDetails !== undefined) staffData.familyDetails = body.familyDetails;
    if (body.emergencyContact !== undefined) staffData.emergencyContact = body.emergencyContact;
    if (body.gender !== undefined) userData.gender = body.gender;
    if (body.dateOfBirth !== undefined) userData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;

    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({ where: { id: staff.userId }, data: userData });
    }
    return this.prisma.staffMember.update({ where: { id: staffId }, data: staffData, include: { user: true } });
  }

  async getStaffDocuments(societyId: string, staffId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    return this.prisma.staffDocument.findMany({
      where: { staffMemberId: staffId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async addStaffDocument(
    societyId: string,
    staffId: string,
    documentType: string,
    fileUrl: string,
    uploadedBy = 'admin',
    verifiedById?: string,
  ) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    return this.prisma.staffDocument.create({
      data: {
        staffMemberId: staffId,
        documentType: this.normalizeDocumentType(documentType),
        fileUrl,
        uploadedBy,
        ...(verifiedById ? { verifiedAt: new Date(), verifiedById } : {}),
      },
    });
  }

  // societyId is REQUIRED — previously was optional with an `if (societyId && ...)`
  // guard, which silently no-op'd when callers didn't pass it. Required now so
  // a future caller can't accidentally bypass the check.
  async deleteStaffDocument(societyId: string, staffId: string, documentId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffMemberId: staffId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.staffDocument.delete({ where: { id: documentId } });
    return { deleted: true };
  }

  // societyId is REQUIRED (see deleteStaffDocument comment).
  async verifyStaffDocument(
    societyId: string,
    staffId: string,
    documentId: string,
    verifiedById: string,
  ) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffMemberId: staffId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.staffDocument.update({
      where: { id: documentId },
      data: { verifiedAt: new Date(), verifiedById },
    });
  }

  private normalizeDocumentType(type: string): string {
    return type.toUpperCase().replace(/AADHAAR/g, 'AADHAR');
  }

  async dismissStaff(societyId: string, staffId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    const now = new Date();
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: { leavingDate: now, deletedAt: now },
    });
    await this.prisma.user.update({ where: { id: staff.userId }, data: { status: 'SUSPENDED' } });
    return { ok: true };
  }

  async getStaffSalarySlips(societyId: string, staffId: string) {
    // Validate staff belongs to caller society before reading salary slips —
    // SalarySlip is not in DIRECT_TENANT_SCOPED, so the Prisma extension
    // won't auto-scope this query. Use findFirst with composite (id, societyId)
    // on StaffMember (which DOES have a direct societyId column) so
    // SUPER_ADMIN with X-Society-Id switch is bounded to the effective
    // tenant just like every other route in this fix.
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    return this.prisma.salarySlip.findMany({
      where: { staffId },
      orderBy: { period: 'desc' },
    });
  }

  async getStaffLoans(societyId: string, staffId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    return this.prisma.staffLoan.findMany({
      where: { staffMemberId: staffId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaffLoan(
    societyId: string,
    staffId: string,
    amount: number,
    reason?: string,
    status?: string,
  ) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffId, societyId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found in this society');
    return this.prisma.staffLoan.create({
      data: {
        staffMemberId: staffId,
        amount,
        reason,
        status: status ?? 'PENDING',
      },
    });
  }

  async approveVisitor(visitorId: string, societyId: string, adminUserId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    if (visitor.resident.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'VISITOR_SOCIETY_MISMATCH', message: 'Visitor belongs to another society' });
    }
    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: adminUserId,
        approvedAt: new Date(),
      },
    });
  }

  async rejectVisitor(visitorId: string, societyId: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { resident: { include: { flat: true } } },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    if (visitor.resident.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'VISITOR_SOCIETY_MISMATCH', message: 'Visitor belongs to another society' });
    }
    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: {
        approvalStatus: 'REJECTED',
      },
    });
  }

  async getResidentDocuments(societyId: string, residentId: string) {
    // Scope by joined User.societyId — Resident has no direct societyId column
    // and the Prisma tenant extension intentionally excludes Resident from
    // auto-scoping (see tenant.extension.ts:64-66).
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
      include: { user: true },
    });
    if (!resident) throw new NotFoundException('Resident not found in this society');

    return {
      name: resident.user.name,
      idProof: resident.idProof,
      addressProof: resident.addressProof,
      documentsStatus: resident.documentsStatus,
    };
  }

  async verifyResidentDocuments(
    societyId: string,
    residentId: string,
    status: 'VERIFIED' | 'REJECTED',
    _note?: string,
  ) {
    // Pre-check ownership before issuing the update — otherwise an admin
    // from another society could flip any resident's documents status by id.
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
      select: { id: true },
    });
    if (!resident) throw new NotFoundException('Resident not found in this society');
    return this.prisma.resident.update({
      where: { id: residentId },
      data: {
        documentsStatus: status as any,
      },
    });
  }

  async getFinancialSnapshot(societyId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;

    const bills = await this.prisma.maintenanceBill.findMany({
      where: { flat: { societyId }, period },
    });

    const collected = bills
      .filter((bill) => bill.status === 'SUCCESS')
      .reduce((sum, bill) => sum + Number(bill.total), 0);
    const outstanding = bills
      .filter((bill) => bill.status === 'PENDING')
      .reduce((sum, bill) => sum + Number(bill.total), 0);
    const overdue = bills
      .filter((bill) => bill.status === 'FAILED')
      .reduce((sum, bill) => sum + Number(bill.total), 0);

    return { collected, outstanding, overdue, period };
  }

  async getActivityFeed(societyId: string) {
    const [visitors, serviceRequests, complaints, sosAlerts] = await Promise.all([
      this.prisma.visitor.findMany({
        where: { resident: { flat: { societyId } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { resident: { include: { user: true } } },
      }),
      this.prisma.serviceRequest.findMany({
        where: { societyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.complaint.findMany({
        where: { societyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.sosAlert.findMany({
        where: { societyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const feed = [
      ...visitors.map((v) => ({
        id: v.id,
        type: 'VISITOR',
        label: `Visitor: ${v.name} for ${v.resident.user.name}`,
        createdAt: v.createdAt,
      })),
      ...serviceRequests.map((sr) => ({
        id: sr.id,
        type: 'SERVICE_REQUEST',
        label: `SR #${sr.id.slice(-6)}: ${sr.category}`,
        createdAt: sr.createdAt,
      })),
      ...complaints.map((c) => ({
        id: c.id,
        type: 'COMPLAINT',
        label: `Complaint: ${c.category}`,
        createdAt: c.createdAt,
      })),
      ...sosAlerts.map((s) => ({
        id: s.id,
        type: 'SOS',
        label: `SOS Alert from flat`,
        createdAt: s.createdAt,
      })),
    ];

    return feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  }

  async getComplaintsByCategory(societyId: string) {
    const grouped = await this.prisma.complaint.groupBy({
      by: ['category'],
      where: { societyId },
      _count: { _all: true },
    });

    return grouped
      .map((g) => ({ category: g.category ?? 'OTHER', count: g._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  async getStaffAttendance(societyId: string, staffId: string, month?: string) {
    const staff = await this.prisma.staffMember.findFirst({ where: { id: staffId, societyId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const target = month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = target.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const records = await this.prisma.staffAttendance.findMany({
      where: { staffId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const rows = records.map((r) => {
      const checkIn = r.checkIn;
      const checkOut = r.checkOut;
      let hoursWorked: number | null = null;
      if (checkIn && checkOut) {
        hoursWorked = Math.round(((checkOut.getTime() - checkIn.getTime()) / 3_600_000) * 100) / 100;
      }
      return {
        date: r.date.toISOString().split('T')[0],
        checkIn: checkIn?.toISOString() ?? null,
        checkOut: checkOut?.toISOString() ?? null,
        hoursWorked,
        late: r.isLate,
        status: r.status,
      };
    });

    const present = rows.filter((r) => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
    const absent = rows.filter((r) => r.status === 'ABSENT').length;
    const late = rows.filter((r) => r.late).length;
    const totalHours = rows.reduce((sum, r) => sum + (r.hoursWorked ?? 0), 0);
    const avgHours = present > 0 ? Math.round((totalHours / present) * 100) / 100 : 0;

    return {
      records: rows,
      summary: { totalDays: records.length, present, absent, late, avgHours },
    };
  }

  async getStaffAttendanceSummary(societyId: string, staffId: string, month?: string) {
    const staff = await this.prisma.staffMember.findFirst({ where: { id: staffId, societyId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const target = month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = target.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const records = await this.prisma.staffAttendance.findMany({
      where: { staffId, date: { gte: start, lt: end } },
    });

    let totalMinutes = 0;
    let overtimeMinutes = 0;
    let daysPresent = 0;
    let daysAbsent = 0;
    let lateCount = 0;

    for (const r of records) {
      if (r.status === 'ABSENT') { daysAbsent += 1; continue; }
      daysPresent += 1;
      if (r.isLate) lateCount += 1;
      if (r.checkIn && r.checkOut) {
        const mins = (r.checkOut.getTime() - r.checkIn.getTime()) / 60_000;
        totalMinutes += mins;
      }
      overtimeMinutes += r.overtimeMinutes ?? 0;
    }

    return {
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
      daysPresent,
      daysAbsent,
      lateCount,
    };
  }

  async exportStaffAttendanceCsv(societyId: string, staffId: string, month?: string): Promise<string> {
    const staff = await this.prisma.staffMember.findFirst({ where: { id: staffId, societyId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const target = month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = target.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const records = await this.prisma.staffAttendance.findMany({
      where: { staffId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const header = 'Date,CheckIn,CheckOut,HoursWorked,Status\n';
    const body = records.map((r) => {
      const date = r.date.toISOString().split('T')[0];
      const checkIn = r.checkIn ? r.checkIn.toISOString() : '';
      const checkOut = r.checkOut ? r.checkOut.toISOString() : '';
      let hoursWorked = '';
      if (r.checkIn && r.checkOut) {
        hoursWorked = (Math.round(((r.checkOut.getTime() - r.checkIn.getTime()) / 3_600_000) * 100) / 100).toString();
      }
      return [date, checkIn, checkOut, hoursWorked, r.status].join(',');
    }).join('\n');

    return header + body;
  }

  async getServiceRequestTrend(societyId: string, days = 30) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const rows = await this.prisma.serviceRequest.findMany({
      where: { societyId, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets: { day: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.push({
        day: String(d.getDate()),
        count: 0,
      });
    }

    for (const row of rows) {
      const idx = Math.floor(
        (row.createdAt.getTime() - since.getTime()) / 86_400_000,
      );
      if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
    }

    return buckets;
  }

  /**
   * F6: dashboard birthdays widget. Returns active residents whose
   * `User.dateOfBirth` matches today's month+day, scoped to the caller's
   * society. We use raw SQL because Prisma's `where` doesn't support
   * EXTRACT(MONTH|DAY ...) cleanly — a JS-side filter would force loading
   * every resident for the month every page render.
   */
  async getBirthdays(societyId: string, on: string) {
    const target = on === 'today' || !on ? new Date() : new Date(on);
    if (Number.isNaN(target.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'Invalid date for ?on' });
    }
    const month = target.getMonth() + 1;
    const day = target.getDate();

    // residents joined to users + flats; user.dateOfBirth carries the canonical
    // value (resident.dateOfBirth is legacy and may be null).
    const rows: Array<{
      residentId: string;
      name: string | null;
      dob: Date;
      block: string | null;
      number: string | null;
    }> = await this.prisma.$queryRaw`
      SELECT r."id"        AS "residentId",
             u."name"      AS "name",
             u."dateOfBirth" AS "dob",
             f."block"     AS "block",
             f."number"    AS "number"
      FROM   "residents" r
      JOIN   "users" u ON u."id" = r."userId"
      LEFT JOIN "flats" f ON f."id" = r."flatId"
      WHERE  u."societyId" = ${societyId}
        AND  r."deletedAt" IS NULL
        AND  u."dateOfBirth" IS NOT NULL
        AND  EXTRACT(MONTH FROM u."dateOfBirth") = ${month}
        AND  EXTRACT(DAY   FROM u."dateOfBirth") = ${day}
      ORDER BY u."name" ASC
    `;

    const today = new Date();
    return rows.map((r) => {
      const dob = new Date(r.dob);
      let age = today.getFullYear() - dob.getFullYear();
      // If the birthday hasn't yet happened "today" in calendar terms it's
      // still their birthday — we already filtered by month+day, so just
      // subtract one if the source year was after target year (improbable
      // but safe).
      if (age < 0) age = 0;
      return {
        id: r.residentId,
        name: r.name ?? 'Resident',
        flat: r.number ? `${r.block ?? ''}${r.number}` : null,
        age,
      };
    });
  }

  // ─── M6: Push Notifications ──────────────────────────────────────────────────

  async sendPushNotification(
    societyId: string,
    dto: {
      title: string;
      body: string;
      targetType: 'ALL' | 'FLAT' | 'BLOCK' | 'INDIVIDUAL';
      targetIds?: string[];
      scheduledAt?: string;
    },
  ) {
    const { title, body, targetType, targetIds, scheduledAt } = dto;

    // If scheduled for future, persist as a Notice (reuse existing model)
    if (scheduledAt) {
      const at = new Date(scheduledAt);
      if (at > new Date()) {
        const notice = await this.prisma.notice.create({
          data: {
            societyId,
            title,
            body,
            category: 'PUSH_SCHEDULED',
            target: targetType === 'BLOCK' ? 'BLOCK' : 'ALL',
            targetBlock: targetType === 'BLOCK' && targetIds?.[0] ? targetIds[0] : undefined,
            publishedAt: at,
          },
        });
        return { scheduled: true, noticeId: notice.id, scheduledAt: at };
      }
    }

    // Immediate send.
    // H6: replaced the serial for-loop with a bounded async pool. A serial
    // send over 500+ residents could stall the request thread for minutes
    // and any single push failure (transient FCM 5xx) would short-circuit
    // the rest of the broadcast.
    const notification = { title, body, category: 'admin_push' };

    if (targetType === 'ALL') {
      await this.push.sendToSociety(societyId, null, notification, { type: 'ADMIN_PUSH' });
      return { scheduled: false, sent: true };
    }

    let userIds: string[] = [];
    if (targetType === 'BLOCK' && targetIds?.length) {
      const residents = await this.prisma.resident.findMany({
        where: { user: { societyId }, flat: { block: { in: targetIds } } },
        include: { user: { select: { id: true } } },
      });
      userIds = residents.map((r) => r.user.id);
    } else if (targetType === 'FLAT' && targetIds?.length) {
      const residents = await this.prisma.resident.findMany({
        where: { user: { societyId }, flat: { number: { in: targetIds } } },
        include: { user: { select: { id: true } } },
      });
      userIds = residents.map((r) => r.user.id);
    } else if (targetType === 'INDIVIDUAL' && targetIds?.length) {
      userIds = targetIds;
    }

    if (userIds.length === 0) {
      return { scheduled: false, sent: 0, failed: 0 };
    }

    const { sent, failed } = await asyncPool(userIds, PUSH_CONCURRENCY, async (uid) => {
      return this.push.send(uid, notification, { type: 'ADMIN_PUSH' });
    });

    return { scheduled: false, sent, failed };
  }

  // ─── M12: SOS Recipients ─────────────────────────────────────────────────────

  async getSosRecipients(societyId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const cfg = (society.config as Record<string, unknown> | null) ?? {};
    return (cfg.sosRecipients as any[]) ?? [];
  }

  async addSosRecipient(
    societyId: string,
    dto: { name: string; phone: string; email?: string; role?: string },
  ) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const cfg = (society.config as Record<string, unknown> | null) ?? {};
    const recipients: any[] = Array.isArray(cfg.sosRecipients) ? [...cfg.sosRecipients] : [];
    // H2: switch off `sos_${Date.now()}` — two recipients added in the same
    // millisecond collided and the second would overwrite the first on removal.
    const newRecipient = { id: `sos_${randomUUID()}`, ...dto };
    recipients.push(newRecipient);
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...cfg, sosRecipients: recipients } },
    });
    return newRecipient;
  }

  async removeSosRecipient(societyId: string, recipientId: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const cfg = (society.config as Record<string, unknown> | null) ?? {};
    const recipients: any[] = Array.isArray(cfg.sosRecipients) ? [...cfg.sosRecipients] : [];
    const next = recipients.filter((r) => r.id !== recipientId);
    await this.prisma.society.update({
      where: { id: societyId },
      data: { config: { ...cfg, sosRecipients: next } },
    });
    return { deleted: true };
  }

  // ─── M13: Residents Export + Bulk Message ────────────────────────────────────

  async exportResidentsCsv(societyId: string): Promise<string> {
    const residents = await this.prisma.resident.findMany({
      where: { user: { societyId }, deletedAt: null },
      include: { user: true, flat: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'name,phone,email,block,flatNumber,type,status\n';
    const body = residents
      .map((r) =>
        toCsvRow([
          r.user.name ?? '',
          r.user.phone ?? '',
          r.user.email ?? '',
          r.flat?.block ?? '',
          r.flat?.number ?? '',
          r.type ?? 'TENANT',
          r.user.status ?? '',
        ]),
      )
      .join('\n');

    return header + body;
  }

  residentsImportTemplate(): string {
    return 'name,phone,email,block,flatNumber,type,dateOfBirth\nJane Doe,+919876543210,jane@example.com,A,101,OWNER,1985-06-15\n';
  }

  flatsImportTemplate(): string {
    return 'block,floor,number,areaSqft\nA,1,101,1200\nA,1,102,1150\n';
  }

  staffImportTemplate(): string {
    return 'name,phone,designation,department,categories,salary\nJohn Guard,+919876543210,Security Guard,SECURITY,SECURITY,18000\n';
  }

  async previewResidentsCsv(societyId: string, csvText: string) {
    return this.processResidentsCsv(societyId, csvText, true);
  }

  async importResidentsCsv(societyId: string, csvText: string) {
    return this.processResidentsCsv(societyId, csvText, false);
  }

  private async processResidentsCsv(
    societyId: string,
    csvText: string,
    previewOnly: boolean,
  ) {
    return this.processResidentsCsvWithClient(this.prisma, societyId, csvText, previewOnly);
  }

  async bulkMessageResidents(
    societyId: string,
    dto: { residentIds: string[]; message: string; channel: 'PUSH' | 'SMS' },
  ) {
    const { residentIds, message, channel } = dto;
    const notification = { title: 'Message from Society Admin', body: message, category: 'admin_push' };
    let sent = 0;

    if (channel === 'PUSH') {
      for (const userId of residentIds) {
        const result = await this.push.send(userId, notification, { type: 'BULK_MESSAGE' });
        if (result.ok) sent++;
      }
    }

    return { sent, total: residentIds.length };
  }

  // ── Building Admins ──────────────────────────────────────────────────────────

  async listBuildingAdmins(societyId: string) {
    return this.prisma.user.findMany({
      where: { societyId, role: UserRole.BUILDING_ADMIN },
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        managedBlocks: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBuildingAdmin(
    societyId: string,
    dto: { name: string; phone: string; managedBlocks: string[] },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { phone_societyId: { phone: dto.phone, societyId } },
    });
    if (existing) {
      throw new ConflictException('A user with this phone already exists in the society');
    }
    return this.prisma.user.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        role: UserRole.BUILDING_ADMIN,
        status: UserStatus.ACTIVE,
        societyId,
        managedBlocks: dto.managedBlocks,
      } as any,
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        managedBlocks: true, createdAt: true,
      },
    });
  }

  async updateManagedBlocks(userId: string, managedBlocks: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.BUILDING_ADMIN) {
      throw new NotFoundException('Building admin not found');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { managedBlocks } as any,
      select: {
        id: true, name: true, phone: true, managedBlocks: true,
      },
    });
  }

  async removeBuildingAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.BUILDING_ADMIN) {
      throw new NotFoundException('Building admin not found');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ── Resident CRUD ────────────────────────────────────────────────────────────

  async getResidentDetail(societyId: string, residentId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
      include: { user: true, flat: true },
    });
    if (!resident) throw new NotFoundException('Resident not found');
    return {
      id: resident.id,
      userId: resident.userId,
      name: resident.user.name,
      phone: resident.user.phone,
      email: resident.user.email,
      status: resident.user.status,
      type: resident.type,
      flat: resident.flat
        ? { id: resident.flat.id, block: resident.flat.block, number: resident.flat.number, floor: resident.flat.floor }
        : null,
      moveInDate: resident.moveInDate,
      moveOutDate: resident.moveOutDate,
      dateOfBirth: (resident as any).dateOfBirth ?? null,
      roleNote: (resident as any).roleNote ?? null,
      appActivatedAt: (resident as any).appActivatedAt ?? null,
      emergencyContact: resident.emergencyContact ?? null,
      createdAt: resident.createdAt,
    };
  }

  async updateResident(
    residentId: string,
    societyId: string,
    body: {
      dateOfBirth?: string | null;
      roleNote?: string | null;
      emergencyContact?: { name?: string; phone?: string } | null;
    },
  ) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
    });
    if (!resident) throw new NotFoundException('Resident not found');

    const data: Record<string, unknown> = {};
    if (body.dateOfBirth !== undefined) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }
    if (body.roleNote !== undefined) data.roleNote = body.roleNote;
    if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact;

    await this.prisma.resident.update({ where: { id: residentId }, data: data as any });
    return this.getResidentDetail(societyId, residentId);
  }

  async createResident(
    societyId: string,
    dto: { name: string; email?: string; phone: string; flatId: string; type: 'OWNER' | 'TENANT'; dateOfBirth?: string | null },
  ) {
    const flat = await this.prisma.flat.findFirst({ where: { id: dto.flatId, societyId } });
    if (!flat) throw new BadRequestException('Flat not found in this society');

    const existing = await this.prisma.user.findFirst({ where: { phone: dto.phone, societyId } });
    if (existing) throw new ConflictException('A user with this phone already exists in the society');

    // Atomic: avoid creating an orphan User row if the Resident create fails
    // (e.g. flat got deleted between checks, FK violation, etc.).
    const resident = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          name: dto.name,
          email: dto.email,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          role: UserRole.RESIDENT,
          status: UserStatus.PENDING,
          societyId,
        },
      });

      return tx.resident.create({
        data: { userId: user.id, flatId: dto.flatId, type: dto.type as any },
        include: { user: true, flat: true },
      });
    });

    return {
      id: resident.id,
      userId: resident.userId,
      name: resident.user.name,
      phone: resident.user.phone,
      email: resident.user.email,
      status: resident.user.status,
      type: resident.type,
      flat: resident.flat ? { block: resident.flat.block, number: resident.flat.number } : null,
      createdAt: resident.createdAt,
    };
  }

  async dismissResident(residentId: string, societyId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
      include: { user: true },
    });
    if (!resident) throw new NotFoundException('Resident not found');

    await this.prisma.resident.update({
      where: { id: residentId },
      data: { moveOutDate: new Date() },
    });
    await this.prisma.user.update({
      where: { id: resident.userId },
      data: { status: UserStatus.INACTIVE },
    });
    return { ok: true };
  }

  async deleteResident(residentId: string, societyId: string, actorRole: string) {
    if (actorRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admins cannot delete residents');
    }
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, user: { societyId } },
    });
    if (!resident) throw new NotFoundException('Resident not found');

    // Soft-delete
    await this.prisma.resident.update({
      where: { id: residentId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // ── Maintenance bill status update ─────────────────────────────────────────

  /**
   * Allowed bill-status transitions (H4). Anything outside this map is
   * rejected with INVALID_BILL_TRANSITION. SUCCESS → PENDING is reserved
   * for SUPER_ADMIN reversal (e.g. an erroneously marked-paid bill); the
   * change is always audited with full before/after snapshot.
   */
  private static readonly BILL_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['SUCCESS', 'WAIVED', 'FAILED'],
    SUCCESS: [], // terminal for normal admins
    WAIVED: ['PENDING'],
    FAILED: ['PENDING', 'SUCCESS'],
  };

  async updateBillStatus(
    billId: string,
    societyId: string,
    status: string,
    actor: { id: string; role: string },
    paymentMethod?: string,
  ) {
    const normalizedStatus = status === 'PAID' ? 'SUCCESS' : status;
    const allowed = ['PENDING', 'SUCCESS', 'WAIVED', 'FAILED'];
    if (!allowed.includes(normalizedStatus)) {
      throw new BadRequestException({
        code: 'INVALID_BILL_STATUS',
        message: `Status must be one of: PENDING, SUCCESS (or PAID), WAIVED, FAILED`,
      });
    }
    const bill = await this.prisma.maintenanceBill.findUnique({
      where: { id: billId },
      include: { flat: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.flat.societyId !== societyId) {
      throw new ForbiddenException({ code: 'BILL_SOCIETY_MISMATCH', message: 'Bill belongs to another society' });
    }

    const current = String(bill.status);
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (current !== normalizedStatus) {
      const transitions = AdminService.BILL_TRANSITIONS[current] ?? [];
      const reversingPaid = current === 'SUCCESS' && normalizedStatus === 'PENDING';
      const allowedNow = reversingPaid
        ? isSuperAdmin
        : transitions.includes(normalizedStatus);
      if (!allowedNow) {
        throw new ConflictException({
          code: 'INVALID_BILL_TRANSITION',
          message: `Cannot move bill from ${current} to ${normalizedStatus}`,
          from: current,
          to: normalizedStatus,
          allowedNext: transitions,
          requiresSuperAdmin: reversingPaid ? true : undefined,
        });
      }
    }

    const updated = await this.prisma.maintenanceBill.update({
      where: { id: billId },
      data: {
        status: normalizedStatus as any,
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
    });

    await this.audit.write({
      entityType: 'MaintenanceBill',
      entityId: billId,
      action: 'BILL_STATUS_CHANGED',
      module: 'admin',
      actorId: actor.id,
      actorRole: actor.role,
      societyId,
      before: { status: current, paymentMethod: (bill as any).paymentMethod ?? null },
      after: { status: normalizedStatus, paymentMethod: paymentMethod ?? (bill as any).paymentMethod ?? null },
    });

    return updated;
  }

  // ── Society CRUD (SUPER_ADMIN) ─────────────────────────────────────────────

  async listAllSocieties(query?: {
    search?: string;
    includeArchived?: boolean;
    status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  }) {
    const where: Record<string, unknown> = {};
    if (query?.status) {
      where.status = query.status;
    } else if (!query?.includeArchived) {
      where.status = { not: 'ARCHIVED' };
    }
    if (query?.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { city: { contains: query.search.trim(), mode: 'insensitive' } },
        { shortCode: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const societies = await this.prisma.society.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { flats: true, users: true } },
      },
    });

    return societies.map((s) => ({
      id: s.id,
      name: s.name,
      shortCode: (s as any).shortCode ?? null,
      address: s.address,
      city: s.city,
      pincode: s.pincode,
      showInDirectory: s.showInDirectory,
      status: (s as any).status,
      suspendedAt: (s as any).suspendedAt,
      suspendedReason: (s as any).suspendedReason,
      contactEmail: (s as any).contactEmail ?? null,
      contactPhone: (s as any).contactPhone ?? null,
      archivedAt: s.archivedAt,
      createdAt: s.createdAt,
      flatCount: s._count.flats,
      userCount: s._count.users,
    }));
  }

  /**
   * Platform-level stats for the SUPER_ADMIN console — totals across all
   * societies plus per-status counts. Caller is SUPER_ADMIN (RolesGuard at
   * the controller); we explicitly flip `superAdminBypass` in the tenant
   * context here so `flat.count()` (a directly-scoped model) returns the
   * global count instead of being silently filtered to the super-admin's
   * home Platform society — which has 0 flats and would mislead the UI.
   */
  async getPlatformStats() {
    return this.withSuperAdminBypass(async () => this.computePlatformStats());
  }

  private async withSuperAdminBypass<T>(fn: () => Promise<T>): Promise<T> {
    const ctx = getTenantContext();
    return runWithTenantContext(
      {
        societyId: ctx?.societyId ?? null,
        userId: ctx?.userId ?? null,
        role: 'SUPER_ADMIN',
        superAdminBypass: true,
        reAuthConfirmed: true,
        requestId: ctx?.requestId,
      },
      fn,
    );
  }

  private async computePlatformStats() {
    const [byStatus, totalUsers, totalFlats, recentSocieties] = await Promise.all([
      this.prisma.society.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.count(),
      this.prisma.flat.count(),
      this.prisma.society.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          city: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
    ]);

    const counts = { ACTIVE: 0, SUSPENDED: 0, ARCHIVED: 0 } as Record<string, number>;
    for (const row of byStatus) counts[row.status] = row._count._all;

    return {
      societies: {
        total: counts.ACTIVE + counts.SUSPENDED + counts.ARCHIVED,
        active: counts.ACTIVE,
        suspended: counts.SUSPENDED,
        archived: counts.ARCHIVED,
      },
      users: { total: totalUsers },
      flats: { total: totalFlats },
      recentSocieties: recentSocieties.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        status: s.status,
        createdAt: s.createdAt,
        userCount: s._count.users,
      })),
    };
  }

  async getSocietyDetail(societyId: string) {
    const society = await this.prisma.society.findUnique({
      where: { id: societyId },
      include: {
        _count: { select: { flats: true, users: true, staff: true } },
      },
    });
    if (!society) throw new NotFoundException('Society not found');

    const activeResidents = await this.prisma.resident.count({
      where: { user: { societyId, status: UserStatus.ACTIVE }, deletedAt: null },
    });

    return {
      id: society.id,
      name: society.name,
      shortCode: (society as any).shortCode ?? null,
      address: society.address,
      city: society.city,
      pincode: society.pincode,
      contactEmail: (society as any).contactEmail ?? null,
      contactPhone: (society as any).contactPhone ?? null,
      config: society.config,
      showInDirectory: society.showInDirectory,
      status: (society as any).status,
      suspendedAt: (society as any).suspendedAt,
      suspendedReason: (society as any).suspendedReason,
      archivedAt: society.archivedAt,
      createdAt: society.createdAt,
      updatedAt: society.updatedAt,
      stats: {
        flats: society._count.flats,
        users: society._count.users,
        staff: society._count.staff,
        activeResidents,
      },
    };
  }

  async createSociety(dto: {
    name: string;
    address: string;
    city: string;
    pincode: string;
    showInDirectory?: boolean;
    adminName: string;
    adminPhone: string;
    adminEmail?: string;
    config?: Record<string, unknown>;
    flatsCsv?: string;
    residentsCsv?: string;
  }) {
    if (!dto.name?.trim() || !dto.address?.trim() || !dto.city?.trim() || !dto.pincode?.trim()) {
      throw new BadRequestException('Society name, address, city, and pincode are required');
    }
    if (!dto.adminName?.trim() || !dto.adminPhone?.trim()) {
      throw new BadRequestException('Admin name and phone are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const society = await tx.society.create({
        data: {
          name: dto.name.trim(),
          address: dto.address.trim(),
          city: dto.city.trim(),
          pincode: dto.pincode.trim(),
          showInDirectory: dto.showInDirectory ?? false,
          config: this.societySeeder.buildDefaultConfig(dto.config) as any,
        },
      });

      const admin = await tx.user.create({
        data: {
          phone: dto.adminPhone.trim(),
          name: dto.adminName.trim(),
          email: dto.adminEmail?.trim() || undefined,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          societyId: society.id,
        },
      });

      let flatsResult = { created: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };
      let residentsResult = { created: 0, skipped: 0, errors: [] as { row: number; reason: string }[], valid: [] as unknown[] };

      if (dto.flatsCsv?.trim()) {
        flatsResult = await this.importFlatsCsvWithClient(tx, society.id, dto.flatsCsv, false);
      }
      if (dto.residentsCsv?.trim()) {
        residentsResult = await this.processResidentsCsvWithClient(tx, society.id, dto.residentsCsv, false);
      }

      return { society, admin, flats: flatsResult, residents: residentsResult };
    });
  }

  async updateSocietyAdmin(
    societyId: string,
    dto: {
      name?: string;
      address?: string;
      city?: string;
      pincode?: string;
      showInDirectory?: boolean;
      contactEmail?: string | null;
      contactPhone?: string | null;
      config?: Record<string, unknown>;
    },
  ) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.pincode !== undefined) data.pincode = dto.pincode;
    if (dto.showInDirectory !== undefined) data.showInDirectory = dto.showInDirectory;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone?.trim() || null;
    if (dto.config !== undefined) {
      const existingConfig = (society.config as Record<string, unknown> | null) ?? {};
      data.config = { ...existingConfig, ...dto.config };
    }

    return this.prisma.society.update({ where: { id: societyId }, data });
  }

  async archiveSociety(societyId: string, actorId?: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    if ((society as any).status === 'ARCHIVED') {
      throw new BadRequestException('Society is already archived');
    }
    await this.assertNotPlatformSociety(societyId, 'archive');

    const before = { status: (society as any).status, archivedAt: society.archivedAt };
    await this.prisma.$transaction([
      this.prisma.society.update({
        where: { id: societyId },
        data: { status: 'ARCHIVED', archivedAt: new Date(), showInDirectory: false } as any,
      }),
      // Soft-revoke all users in the archived society — login is already
      // blocked by the society gate, but this also flips API access for
      // any cached JWTs that haven't expired yet.
      this.prisma.user.updateMany({
        where: { societyId },
        data: { status: UserStatus.INACTIVE },
      }),
    ]);

    await this.audit.write({
      entityType: 'Society',
      entityId: societyId,
      action: 'SOCIETY_ARCHIVED',
      module: 'platform',
      actorId: actorId ?? null,
      actorRole: 'SUPER_ADMIN',
      before,
      after: { status: 'ARCHIVED' },
      societyId,
    });

    return { archived: true };
  }

  async restoreSociety(societyId: string, actorId?: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    if ((society as any).status !== 'ARCHIVED') {
      throw new BadRequestException('Society is not archived');
    }

    await this.prisma.society.update({
      where: { id: societyId },
      data: { status: 'ACTIVE', archivedAt: null } as any,
    });

    await this.audit.write({
      entityType: 'Society',
      entityId: societyId,
      action: 'SOCIETY_RESTORED',
      module: 'platform',
      actorId: actorId ?? null,
      actorRole: 'SUPER_ADMIN',
      before: { status: 'ARCHIVED' },
      after: { status: 'ACTIVE' },
      societyId,
    });

    return { restored: true };
  }

  /**
   * Reversible lifecycle: SUSPENDED means logins are blocked but data is
   * preserved exactly as-is. Use cases: non-payment, security incident,
   * compliance hold. Distinct from ARCHIVED which implies end-of-life.
   */
  async suspendSociety(societyId: string, actorId: string, reason?: string) {
    // Hard cap on reason to prevent oversize writes from controller-side JSON.
    if (reason && reason.length > 500) {
      throw new BadRequestException('Suspension reason cannot exceed 500 characters');
    }

    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const status = (society as any).status;
    if (status === 'SUSPENDED') {
      throw new BadRequestException('Society is already suspended');
    }
    if (status === 'ARCHIVED') {
      throw new BadRequestException('Cannot suspend an archived society — restore it first');
    }
    await this.assertNotPlatformSociety(societyId, 'suspend');

    const before = { status: (society as any).status };
    await this.prisma.society.update({
      where: { id: societyId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedReason: reason?.trim() || null,
        suspendedById: actorId,
      } as any,
    });

    await this.audit.write({
      entityType: 'Society',
      entityId: societyId,
      action: 'SOCIETY_SUSPENDED',
      module: 'platform',
      actorId,
      actorRole: 'SUPER_ADMIN',
      before,
      after: { status: 'SUSPENDED', reason: reason?.trim() || null },
      societyId,
    });

    return { suspended: true };
  }

  /**
   * Refuses to lock down any society that hosts a SUPER_ADMIN — otherwise the
   * platform's only operator would be locked out of their own JWT-refresh and
   * recovery would require direct DB access. Errs on the safe side: ANY
   * super-admin in the target society blocks the operation.
   */
  private async assertNotPlatformSociety(
    societyId: string,
    operation: 'suspend' | 'archive',
  ): Promise<void> {
    const platformAdminCount = await this.prisma.user.count({
      where: { societyId, role: UserRole.SUPER_ADMIN },
    });
    if (platformAdminCount > 0) {
      throw new BadRequestException({
        code: 'PLATFORM_SOCIETY_PROTECTED',
        message: `Cannot ${operation} a society that hosts platform super-admins. Move them to another society first.`,
      });
    }
  }

  async resumeSociety(societyId: string, actorId?: string) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    if ((society as any).status !== 'SUSPENDED') {
      throw new BadRequestException('Society is not suspended');
    }

    const before = {
      status: 'SUSPENDED',
      suspendedAt: (society as any).suspendedAt,
      suspendedReason: (society as any).suspendedReason,
    };
    await this.prisma.society.update({
      where: { id: societyId },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedReason: null,
        suspendedById: null,
      } as any,
    });

    await this.audit.write({
      entityType: 'Society',
      entityId: societyId,
      action: 'SOCIETY_RESUMED',
      module: 'platform',
      actorId: actorId ?? null,
      actorRole: 'SUPER_ADMIN',
      before,
      after: { status: 'ACTIVE' },
      societyId,
    });

    return { resumed: true };
  }

  // ── Flat CRUD ──────────────────────────────────────────────────────────────

  async listFlats(societyId: string, query?: { block?: string; search?: string }) {
    const where: Record<string, unknown> = { societyId };
    if (query?.block) where.block = query.block;
    if (query?.search?.trim()) {
      where.OR = [
        { number: { contains: query.search.trim(), mode: 'insensitive' } },
        { block: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const flats = await this.prisma.flat.findMany({
      where,
      orderBy: [{ block: 'asc' }, { floor: 'asc' }, { number: 'asc' }],
      include: {
        _count: { select: { residents: { where: { deletedAt: null } } } },
      },
    });

    return flats.map((f) => ({
      id: f.id,
      block: f.block,
      floor: f.floor,
      number: f.number,
      areaSqft: f.areaSqft,
      residentCount: f._count.residents,
      occupied: f._count.residents > 0,
    }));
  }

  async getFlat(societyId: string, flatId: string) {
    const flat = await this.prisma.flat.findFirst({
      where: { id: flatId, societyId },
      include: {
        residents: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, phone: true, status: true } } },
        },
      },
    });
    if (!flat) throw new NotFoundException('Flat not found');
    return flat;
  }

  async createFlat(
    societyId: string,
    dto: { block: string; floor: number; number: string; areaSqft?: number },
  ) {
    try {
      return await this.prisma.flat.create({
        data: {
          societyId,
          block: dto.block.trim(),
          floor: dto.floor,
          number: dto.number.trim(),
          areaSqft: dto.areaSqft,
        },
      });
    } catch {
      throw new ConflictException('Flat already exists for this block and number');
    }
  }

  async updateFlat(
    societyId: string,
    flatId: string,
    dto: { block?: string; floor?: number; number?: string; areaSqft?: number | null },
  ) {
    const flat = await this.prisma.flat.findFirst({ where: { id: flatId, societyId } });
    if (!flat) throw new NotFoundException('Flat not found');

    try {
      return await this.prisma.flat.update({
        where: { id: flatId },
        data: {
          ...(dto.block !== undefined ? { block: dto.block.trim() } : {}),
          ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
          ...(dto.number !== undefined ? { number: dto.number.trim() } : {}),
          ...(dto.areaSqft !== undefined ? { areaSqft: dto.areaSqft } : {}),
        },
      });
    } catch {
      throw new ConflictException('Flat already exists for this block and number');
    }
  }

  async deleteFlat(societyId: string, flatId: string) {
    const flat = await this.prisma.flat.findFirst({
      where: { id: flatId, societyId },
      include: { residents: { where: { deletedAt: null } } },
    });
    if (!flat) throw new NotFoundException('Flat not found');
    if (flat.residents.length > 0) {
      throw new BadRequestException('Cannot delete flat with active residents');
    }
    await this.prisma.flat.delete({ where: { id: flatId } });
    return { deleted: true };
  }

  async listBlocks(societyId: string) {
    const flats = await this.prisma.flat.findMany({
      where: { societyId },
      select: { block: true, residents: { where: { deletedAt: null }, select: { id: true } } },
    });
    const blockMap = new Map<string, { flatCount: number; occupiedCount: number }>();
    for (const flat of flats) {
      const entry = blockMap.get(flat.block) ?? { flatCount: 0, occupiedCount: 0 };
      entry.flatCount++;
      if (flat.residents.length > 0) entry.occupiedCount++;
      blockMap.set(flat.block, entry);
    }
    return Array.from(blockMap.entries())
      .map(([block, stats]) => ({ block, ...stats }))
      .sort((a, b) => a.block.localeCompare(b.block));
  }

  async exportFlatsCsv(societyId: string): Promise<string> {
    const flats = await this.prisma.flat.findMany({
      where: { societyId },
      orderBy: [{ block: 'asc' }, { floor: 'asc' }, { number: 'asc' }],
    });
    const header = 'block,floor,number,areaSqft\n';
    const body = flats
      .map((f) => toCsvRow([f.block, String(f.floor), f.number, f.areaSqft != null ? String(f.areaSqft) : '']))
      .join('\n');
    return header + body;
  }

  async previewFlatsCsv(societyId: string, csvText: string) {
    return this.importFlatsCsv(societyId, csvText, true);
  }

  async importFlatsCsv(societyId: string, csvText: string, previewOnly = false) {
    return this.importFlatsCsvWithClient(this.prisma, societyId, csvText, previewOnly);
  }

  private async importFlatsCsvWithClient(
    client: { flat: PrismaService['flat'] },
    societyId: string,
    csvText: string,
    previewOnly: boolean,
  ) {
    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException('CSV is empty or has only a header');
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];
    const valid: { row: number; block: string; floor: number; number: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const record = rowToRecord(headers, rows[i]);
      const block = record['block']?.trim();
      const floorRaw = record['floor']?.trim();
      const number = record['number']?.trim() || record['flatnumber']?.trim();
      const areaRaw = record['areasqft']?.trim() || record['area']?.trim();

      if (!block || !number || !floorRaw) {
        errors.push({ row: i + 2, reason: 'Missing block, floor, or number' });
        continue;
      }

      const floor = parseInt(floorRaw, 10);
      if (Number.isNaN(floor)) {
        errors.push({ row: i + 2, reason: 'Invalid floor' });
        continue;
      }

      const areaSqft = areaRaw ? parseFloat(areaRaw) : undefined;

      try {
        const existing = await client.flat.findFirst({
          where: { societyId, block, number },
        });
        if (existing) {
          skipped++;
          continue;
        }

        valid.push({ row: i + 2, block, floor, number });
        if (previewOnly) continue;

        await client.flat.create({
          data: {
            societyId,
            block,
            floor,
            number,
            areaSqft: areaSqft != null && !Number.isNaN(areaSqft) ? areaSqft : undefined,
          },
        });
        created++;
      } catch (err) {
        errors.push({ row: i + 2, reason: (err as Error).message });
      }
    }

    return { created, skipped, errors, valid, preview: previewOnly };
  }

  private async processResidentsCsvWithClient(
    client: {
      user: PrismaService['user'];
      flat: PrismaService['flat'];
      resident: PrismaService['resident'];
    },
    societyId: string,
    csvText: string,
    previewOnly: boolean,
  ) {
    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException('CSV is empty or has only a header');
    }

    const nameKey = headers.find((h) => ['name', 'fullname'].includes(h)) ?? 'name';
    const phoneKey = headers.find((h) => ['phone', 'mobile', 'phonenumber'].includes(h)) ?? 'phone';
    const emailKey = headers.find((h) => ['email', 'emailaddress'].includes(h)) ?? 'email';
    const blockKey = headers.find((h) => ['block', 'tower', 'wing'].includes(h)) ?? 'block';
    const flatKey = headers.find((h) => ['flatnumber', 'flat', 'unit', 'number'].includes(h)) ?? 'flatnumber';
    const typeKey = headers.find((h) => ['type', 'residenttype'].includes(h)) ?? 'type';
    const dobKey = headers.find((h) => ['dateofbirth', 'dob', 'date_of_birth', 'birthdate', 'birthday'].includes(h));

    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];
    const valid: unknown[] = [];

    for (let i = 0; i < rows.length; i++) {
      const record = rowToRecord(headers, rows[i]);
      const name = record[nameKey] || record['name'];
      const phone = record[phoneKey] || record['phone'];
      const email = record[emailKey] || record['email'];
      const block = record[blockKey] || record['block'];
      const flatNumber = record[flatKey] || record['flatnumber'] || record['flat'];
      const typeRaw = (record[typeKey] || record['type'] || 'TENANT').toUpperCase();
      const type = typeRaw === 'OWNER' ? 'OWNER' : 'TENANT';
      const dobRaw = dobKey ? record[dobKey] : undefined;

      if (!name || !phone) {
        errors.push({ row: i + 2, reason: 'Missing name or phone' });
        continue;
      }

      try {
        const existing = await client.user.findFirst({ where: { phone, societyId } });
        if (existing) {
          skipped++;
          continue;
        }

        const flatWhere: { societyId: string; number: string; block?: string } = {
          societyId,
          number: flatNumber,
        };
        if (block) flatWhere.block = block;
        const flat = flatNumber ? await client.flat.findFirst({ where: flatWhere }) : null;

        if (flatNumber && !flat) {
          errors.push({ row: i + 2, reason: `Flat not found: ${block ? `${block}-` : ''}${flatNumber}` });
          continue;
        }

        valid.push({ row: i + 2, name, phone, flatNumber, block });
        if (previewOnly) continue;

        const user = await client.user.create({
          data: {
            phone,
            name,
            email: email || undefined,
            dateOfBirth: dobRaw ? new Date(dobRaw) : undefined,
            role: UserRole.RESIDENT,
            status: UserStatus.PENDING,
            societyId,
          },
        });

        if (flat) {
          await client.resident.create({
            data: { userId: user.id, flatId: flat.id, type: type as any },
          });
        }
        created++;
      } catch (err) {
        errors.push({ row: i + 2, reason: (err as Error).message });
      }
    }

    return { created, skipped, errors, valid, preview: previewOnly };
  }

  // ── Staff bulk import ──────────────────────────────────────────────────────

  async previewStaffCsv(societyId: string, csvText: string) {
    return this.importStaffCsv(societyId, csvText, true);
  }

  async importStaffCsv(societyId: string, csvText: string, previewOnly = false) {
    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException('CSV is empty or has only a header');
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];
    const valid: { row: number; name: string; phone: string; designation: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const record = rowToRecord(headers, rows[i]);
      const name = record['name']?.trim();
      const phone = record['phone']?.trim();
      const designation = record['designation']?.trim();
      const department = record['department']?.trim();
      const categoriesRaw = record['categories']?.trim();
      const salaryRaw = record['salary']?.trim();

      if (!name || !phone || !designation) {
        errors.push({ row: i + 2, reason: 'Missing name, phone, or designation' });
        continue;
      }

      const categories = categoriesRaw
        ? categoriesRaw.split(/[|,]/).map((c) => c.trim()).filter(Boolean)
        : department
          ? [department]
          : ['OTHER'];

      const salary = salaryRaw ? parseFloat(salaryRaw) : undefined;

      try {
        const existingStaff = await this.prisma.staffMember.findFirst({
          where: { user: { phone }, societyId },
        });
        if (existingStaff) {
          skipped++;
          continue;
        }

        valid.push({ row: i + 2, name, phone, designation });
        if (previewOnly) continue;

        await this.createStaff(societyId, {
          phone,
          name,
          designation,
          department,
          categories,
          salary,
        });
        created++;
      } catch (err) {
        errors.push({ row: i + 2, reason: (err as Error).message });
      }
    }

    return { created, skipped, errors, valid, preview: previewOnly };
  }

  // ── Domestic Help (admin) ───────────────────────────────────────────────────

  async getDomesticHelpers(societyId: string) {
    const helpers = await this.prisma.domesticHelp.findMany({
      where: { resident: { flat: { societyId } } },
      include: {
        resident: {
          include: {
            user: { select: { name: true } },
            flat: { select: { number: true, block: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return helpers.map((h) => ({
      ...h,
      resident: h.resident
        ? {
            id: h.resident.id,
            name: h.resident.user.name,
            unit: { flatNumber: `${h.resident.flat.block}-${h.resident.flat.number}` },
          }
        : undefined,
    }));
  }

  // ── Pest Control (admin) ────────────────────────────────────────────────────

  async getPestControlJobs(societyId: string) {
    return this.prisma.pestControlSchedule.findMany({
      where: { societyId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  // ── Infrastructure CRUD + bulk import ───────────────────────────────────────

  async createInfrastructureItem(
    societyId: string,
    dto: { name: string; type: string; status?: string },
  ) {
    const type = dto.type?.toUpperCase();
    if (!Object.values(InfrastructureType).includes(type as InfrastructureType)) {
      throw new BadRequestException(
        `Invalid type "${dto.type}". Allowed: ${Object.values(InfrastructureType).join(', ')}`,
      );
    }
    const status = (dto.status?.toUpperCase() as InfrastructureStatus) || InfrastructureStatus.OPERATIONAL;
    if (!Object.values(InfrastructureStatus).includes(status)) {
      throw new BadRequestException(
        `Invalid status "${dto.status}". Allowed: ${Object.values(InfrastructureStatus).join(', ')}`,
      );
    }
    return this.prisma.infrastructureItem.create({
      data: { societyId, name: dto.name.trim(), type: type as InfrastructureType, status },
    });
  }

  infrastructureImportTemplate(): string {
    return (
      'name,type,status\n' +
      'Main Lift,LIFT,OPERATIONAL\n' +
      'Backup Generator,GENERATOR,OPERATIONAL\n' +
      'Borewell Pump,WATER,MAINTENANCE\n'
    );
  }

  async exportInfrastructureCsv(societyId: string): Promise<string> {
    const items = await this.prisma.infrastructureItem.findMany({
      where: { societyId },
      orderBy: { name: 'asc' },
    });
    const header = 'name,type,status\n';
    const body = items.map((i) => toCsvRow([i.name, i.type, i.status])).join('\n');
    return header + body;
  }

  async previewInfrastructureCsv(societyId: string, csvText: string) {
    return this.importInfrastructureCsv(societyId, csvText, true);
  }

  async importInfrastructureCsv(societyId: string, csvText: string, previewOnly = false) {
    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException('CSV is empty or has only a header');
    }

    const validTypes = Object.values(InfrastructureType) as string[];
    const validStatuses = Object.values(InfrastructureStatus) as string[];

    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];
    const valid: { row: number; name: string; type: string; status: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const record = rowToRecord(headers, rows[i]);
      const name = record['name']?.trim();
      const type = record['type']?.trim().toUpperCase();
      const statusRaw = record['status']?.trim().toUpperCase();
      const status = statusRaw || InfrastructureStatus.OPERATIONAL;

      if (!name || !type) {
        errors.push({ row: i + 2, reason: 'Missing name or type' });
        continue;
      }
      if (!validTypes.includes(type)) {
        errors.push({ row: i + 2, reason: `Invalid type "${type}" (allowed: ${validTypes.join(', ')})` });
        continue;
      }
      if (!validStatuses.includes(status)) {
        errors.push({ row: i + 2, reason: `Invalid status "${status}" (allowed: ${validStatuses.join(', ')})` });
        continue;
      }

      try {
        const existing = await this.prisma.infrastructureItem.findFirst({
          where: { societyId, name },
        });
        if (existing) {
          skipped++;
          continue;
        }

        valid.push({ row: i + 2, name, type, status });
        if (previewOnly) continue;

        await this.prisma.infrastructureItem.create({
          data: {
            societyId,
            name,
            type: type as InfrastructureType,
            status: status as InfrastructureStatus,
          },
        });
        created++;
      } catch (err) {
        errors.push({ row: i + 2, reason: (err as Error).message });
      }
    }

    return { created, skipped, errors, valid, preview: previewOnly };
  }
}
