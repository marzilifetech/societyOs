import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { requireLeavePendingInSociety } from '../../common/utils/leave-admin.util';

const LEAVE_ENTITLEMENTS: Record<string, number> = {
  CASUAL: 12,
  MEDICAL: 10,
  PRIVILEGE: 15,
  SICK: 10,
  ANNUAL: 15,
  EMERGENCY: 5,
};

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private realtime: RealtimeGateway,
  ) {}

  private async resolveStaffId(userId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.id;
  }

  async getProfile(userId: string) {
    const staff = await this.prisma.staffMember.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  async findBySociety(societyId: string) {
    return this.prisma.staffMember.findMany({
      where: { societyId },
      include: { user: true },
    });
  }

  async checkIn(
    userId: string,
    lat?: number,
    lng?: number,
    photoUrl?: string,
    biometricVerified?: boolean,
    deviceId?: string,
  ) {
    const staff = await this.prisma.staffMember.findUnique({
      where: { userId },
      include: { society: true },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const staffId = staff.id;

    if (lat != null && lng != null) {
      const ok = this.validateGeofence(staff.society as any, lat, lng);
      if (!ok) throw new BadRequestException('Outside society geofence');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isLate = await this.isLateForToday(staffId, new Date());

    return this.prisma.staffAttendance.upsert({
      where: { staffId_date: { staffId, date: today } },
      create: {
        staffId,
        date: today,
        checkIn: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        photoUrl,
        isLate,
        biometricVerified: biometricVerified ?? false,
        deviceId,
      },
      update: {
        checkIn: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        photoUrl,
        isLate,
        biometricVerified: biometricVerified ?? false,
        deviceId,
      },
    });
  }

  async checkOut(userId: string, lat?: number, lng?: number) {
    const staffId = await this.resolveStaffId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shiftEnd = new Date();
    shiftEnd.setHours(18, 0, 0, 0);
    const isEarlyDeparture = new Date() < shiftEnd;

    return this.prisma.staffAttendance.update({
      where: { staffId_date: { staffId, date: today } },
      data: {
        checkOut: new Date(),
        checkOutLat: lat,
        checkOutLng: lng,
        isEarlyDeparture,
      },
    });
  }

  async getAttendance(userId: string, month: number, year: number) {
    const staffId = await this.resolveStaffId(userId);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return this.prisma.staffAttendance.findMany({
      where: { staffId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  async requestLeave(
    userId: string,
    dto: { type: string; startDate: string; endDate: string; reason: string },
  ) {
    const staffId = await this.resolveStaffId(userId);

    const balance = await this.getLeaveBalance(userId);
    const entry = (balance as any)[dto.type];
    if (entry && entry.total - entry.used <= 0) {
      throw new BadRequestException(`No ${dto.type} leave balance remaining`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new BadRequestException({ code: 'PAST_DATE', message: 'Leave cannot start in the past' });
    }
    if (end < start) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: 'End date must be on or after start date' });
    }

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        staffId,
        status: { in: ['PENDING', 'APPROVED'] },
        AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
      },
    });
    if (overlapping) {
      throw new ConflictException({
        code: 'LEAVE_OVERLAP',
        message: 'Dates overlap an existing leave request',
        conflictingId: overlapping.id,
      });
    }

    return this.prisma.leaveRequest.create({
      data: {
        staffId,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });
  }

  async updateLeave(
    leaveId: string,
    societyId: string,
    status: 'APPROVED' | 'REJECTED',
    adminNote?: string,
  ) {
    await requireLeavePendingInSociety(this.prisma, leaveId, societyId);
    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status, ...(adminNote !== undefined ? { adminNote } : {}) },
    });
  }

  async getMyLeaves(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.prisma.leaveRequest.findMany({
      where: { staffId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTodayAttendance(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date: today } },
    });
  }

  async getSummary(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [attendance, leaves, todayRecord] = await Promise.all([
      this.prisma.staffAttendance.count({ where: { staffId, date: { gte: monthStart, lte: monthEnd } } }),
      this.prisma.leaveRequest.count({ where: { staffId, status: 'APPROVED', startDate: { gte: monthStart } } }),
      this.prisma.staffAttendance.findUnique({ where: { staffId_date: { staffId, date: today } } }),
    ]);

    return { attendanceCount: attendance, approvedLeaves: leaves, todayRecord };
  }

  // ─── Geofence + biometric (tasks 9-13) ─────────────────────────────────

  validateGeofence(society: { config?: any }, lat: number, lng: number): boolean {
    const cfg = (society?.config as any) || {};
    const geofence = cfg.geofence;
    if (!geofence) return true; // no geofence configured → permissive
    if (Array.isArray(geofence?.polygon) && geofence.polygon.length >= 3) {
      return this.pointInPolygon([lat, lng], geofence.polygon);
    }
    if (geofence?.center && typeof geofence.radius === 'number') {
      const d = this.haversineMeters(lat, lng, geofence.center.lat, geofence.center.lng);
      return d <= geofence.radius;
    }
    return true;
  }

  private pointInPolygon(point: [number, number], poly: Array<[number, number] | { lat: number; lng: number }>) {
    const [x, y] = point;
    const pts = poly.map((p) => (Array.isArray(p) ? p : [p.lat, p.lng])) as Array<[number, number]>;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async isLateForToday(staffId: string, now: Date): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shift = await this.prisma.shift.findFirst({
      where: { staffId, date: today },
      orderBy: { startTime: 'asc' },
    });
    let h = 9;
    let m = 0;
    if (shift?.startTime) {
      const parts = shift.startTime.split(':');
      h = parseInt(parts[0] || '9', 10);
      m = parseInt(parts[1] || '0', 10);
    }
    const cutoff = new Date();
    cutoff.setHours(h, m, 0, 0);
    return now > cutoff;
  }

  async submitLateReason(userId: string, reason: string) {
    const staffId = await this.resolveStaffId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.staffAttendance.update({
      where: { staffId_date: { staffId, date: today } },
      data: { lateReason: reason },
    });
  }

  // ─── Shifts + holidays (tasks 14-18) ─────────────────────────────────

  async getShifts(userId: string, range: 'today' | 'week' | 'upcoming' = 'today') {
    const staffId = await this.resolveStaffId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let where: any = { staffId };
    if (range === 'today') {
      where.date = today;
    } else if (range === 'week') {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      where.date = { gte: today, lte: end };
    } else {
      where.date = { gte: today };
    }
    return this.prisma.shift.findMany({ where, orderBy: { date: 'asc' } });
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

  async createHoliday(societyId: string, dto: { date: string; name: string; isOptional?: boolean }) {
    return this.prisma.holiday.create({
      data: {
        societyId,
        date: new Date(dto.date),
        name: dto.name,
        isOptional: dto.isOptional ?? false,
      },
    });
  }

  // ─── Tasks/SR extension (tasks 19-24) ───────────────────────────────

  async acceptTask(userId: string, requestId: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    if (sr.assignedToIds?.length && !sr.assignedToIds.includes(staffId)) {
      throw new ForbiddenException('Not assigned to you');
    }
    const assignedToIds = sr.assignedToIds?.includes(staffId)
      ? sr.assignedToIds
      : [...(sr.assignedToIds ?? []), staffId];
    return this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS', acceptedAt: new Date(), assignedToIds },
    });
  }

  async rejectTask(userId: string, requestId: string, reason: string) {
    const staffId = await this.resolveStaffId(userId);
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!sr) throw new NotFoundException('Service request not found');
    if (sr.assignedToIds?.length && !sr.assignedToIds.includes(staffId)) {
      throw new ForbiddenException('Not assigned to you');
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'PENDING', rejectedReason: reason, assignedToIds: [] },
    });
    this.realtime.emit(`society:${sr.societyId}:admin`, 'task:rejected', { requestId, reason, staffId });
    return updated;
  }

  async addTaskNote(userId: string, requestId: string, body: string, voiceUrl?: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.prisma.taskNote.create({
      data: { serviceRequestId: requestId, staffId, body, voiceUrl },
    });
  }

  async getPresignedTaskUploadUrl(requestId: string, phase: 'BEFORE' | 'DURING' | 'AFTER', contentType?: string) {
    return this.s3.getPresignedUploadUrl(`service-requests/${requestId}/${phase.toLowerCase()}`, contentType);
  }

  async confirmTaskPhoto(
    requestId: string,
    key: string,
    phase: 'BEFORE' | 'DURING' | 'AFTER',
    lat?: number,
    lng?: number,
    takenAt?: string,
  ) {
    return this.prisma.servicePhoto.create({
      data: {
        serviceRequestId: requestId,
        phase,
        url: this.s3.getPublicUrl(key),
        lat,
        lng,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
      },
    });
  }

  async getMyTaskHistory(userId: string, status?: string, page = 1, pageSize = 20) {
    const staffId = await this.resolveStaffId(userId);
    const skip = (page - 1) * pageSize;
    const where: any = { assignedToIds: { has: staffId } };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: { resident: { include: { user: true, flat: true } }, photos: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // ─── Reviews + leaderboard (tasks 25-28) ─────────────────────────────

  async getMyReviews(userId: string, page = 1, pageSize = 20) {
    const staffId = await this.resolveStaffId(userId);
    const skip = (page - 1) * pageSize;
    const [items, total, agg] = await Promise.all([
      this.prisma.staffReview.findMany({
        where: { staffId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.staffReview.count({ where: { staffId } }),
      this.prisma.staffReview.aggregate({
        where: { staffId },
        _avg: { rating: true },
      }),
    ]);
    const avgRating = total ? Number(agg._avg.rating ?? 0) : 0;
    // resolve resident identity
    const residentIds = Array.from(new Set(items.map((i) => i.residentId)));
    const residents = residentIds.length
      ? await this.prisma.resident.findMany({
          where: { id: { in: residentIds } },
          include: { user: true, flat: true },
        })
      : [];
    const rmap = new Map(residents.map((r) => [r.id, r]));
    const enriched = items.map((r) => {
      const res = rmap.get(r.residentId);
      return {
        ...r,
        reviewer: res
          ? { name: res.user?.name ?? 'Anonymous', flat: res.flat?.number ?? null }
          : { name: 'Anonymous', flat: null },
      };
    });
    return { items: enriched, total, page, pageSize, avgRating };
  }

  async getMyPerformance(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    const reviews = await this.prisma.staffReview.findMany({ where: { staffId } });
    const count = reviews.length;
    const avgRating = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    // 30-day trend
    const thirty = new Date();
    thirty.setDate(thirty.getDate() - 30);
    const recent = reviews.filter((r) => r.createdAt >= thirty);
    const trend30d: Array<{ day: string; avg: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayKey = d.toISOString().slice(0, 10);
      const dayReviews = recent.filter((r) => r.createdAt.toISOString().slice(0, 10) === dayKey);
      const avg = dayReviews.length ? dayReviews.reduce((s, r) => s + r.rating, 0) / dayReviews.length : 0;
      trend30d.push({ day: dayKey, avg });
    }

    // leaderboard rank within society
    const me = await this.prisma.staffMember.findUnique({ where: { id: staffId } });
    const allStaff = me
      ? await this.prisma.staffMember.findMany({ where: { societyId: me.societyId } })
      : [];
    const allReviews = allStaff.length
      ? await this.prisma.staffReview.findMany({ where: { staffId: { in: allStaff.map((s) => s.id) } } })
      : [];
    const byStaff = new Map<string, { sum: number; n: number }>();
    for (const r of allReviews) {
      const cur = byStaff.get(r.staffId) ?? { sum: 0, n: 0 };
      cur.sum += r.rating;
      cur.n += 1;
      byStaff.set(r.staffId, cur);
    }
    const ranked = allStaff
      .map((s) => {
        const v = byStaff.get(s.id);
        return { staffId: s.id, avg: v && v.n ? v.sum / v.n : 0 };
      })
      .sort((a, b) => b.avg - a.avg);
    const leaderboardRank = ranked.findIndex((r) => r.staffId === staffId) + 1;

    return {
      avgRating,
      count,
      trend30d,
      leaderboardRank,
      leaderboardSize: ranked.length,
    };
  }

  async getLeaderboard(societyId: string, period: 'WEEK' | 'MONTH' | 'QUARTER' = 'MONTH') {
    const now = new Date();
    let since: Date;
    if (period === 'WEEK') {
      since = new Date(now);
      since.setDate(since.getDate() - 7);
    } else if (period === 'QUARTER') {
      since = new Date(now);
      since.setDate(since.getDate() - 90);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const allStaff = await this.prisma.staffMember.findMany({
      where: { societyId },
      include: { user: true },
    });
    const staffIds = allStaff.map((s) => s.id);
    if (!staffIds.length) return [];

    const [serviceRequests, reviews, attendance] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where: {
          assignedToIds: { hasSome: staffIds },
          status: 'COMPLETED',
          updatedAt: { gte: since },
        },
        select: { assignedToIds: true, resolvedAt: true, slaDeadline: true },
      }),
      this.prisma.staffReview.findMany({
        where: { staffId: { in: staffIds }, createdAt: { gte: since } },
        select: { staffId: true, rating: true },
      }),
      this.prisma.staffAttendance.findMany({
        where: { staffId: { in: staffIds }, date: { gte: since } },
        select: { staffId: true, isLate: true },
      }),
    ]);

    const tasksByStaff = new Map<string, { count: number; onTime: number }>();
    for (const sr of serviceRequests) {
      for (const staffId of sr.assignedToIds) {
        if (!staffIds.includes(staffId)) continue;
        const cur = tasksByStaff.get(staffId) ?? { count: 0, onTime: 0 };
        cur.count += 1;
        const completedOn = sr.resolvedAt ?? new Date();
        if (!sr.slaDeadline || completedOn <= sr.slaDeadline) cur.onTime += 1;
        tasksByStaff.set(staffId, cur);
      }
    }

    const ratingsByStaff = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const cur = ratingsByStaff.get(r.staffId) ?? { sum: 0, n: 0 };
      cur.sum += r.rating;
      cur.n += 1;
      ratingsByStaff.set(r.staffId, cur);
    }

    const attendanceByStaff = new Map<string, { total: number; onTime: number }>();
    for (const a of attendance) {
      const cur = attendanceByStaff.get(a.staffId) ?? { total: 0, onTime: 0 };
      cur.total += 1;
      if (!a.isLate) cur.onTime += 1;
      attendanceByStaff.set(a.staffId, cur);
    }

    const ranked = allStaff
      .map((s) => {
        const tasks = tasksByStaff.get(s.id) ?? { count: 0, onTime: 0 };
        const ratings = ratingsByStaff.get(s.id) ?? { sum: 0, n: 0 };
        const att = attendanceByStaff.get(s.id) ?? { total: 0, onTime: 0 };
        return {
          id: s.id,
          name: (s.user as any)?.name ?? 'Unknown',
          tasksCompleted: tasks.count,
          avgRating: ratings.n ? Math.round((ratings.sum / ratings.n) * 100) / 100 : 0,
          onTimeRate: tasks.count ? Math.round((tasks.onTime / tasks.count) * 100) / 100 : 0,
          attendanceRate: att.total ? Math.round((att.onTime / att.total) * 100) / 100 : 0,
        };
      })
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    return ranked.map((entry, i) => ({ rank: i + 1, ...entry }));
  }

  async flagReview(userId: string, reviewId: string, reason: string) {
    const staffId = await this.resolveStaffId(userId);
    const review = await this.prisma.staffReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.staffId !== staffId) throw new ForbiddenException('Not your review');
    return this.prisma.staffReview.update({
      where: { id: reviewId },
      data: { flagged: true, flagReason: reason },
    });
  }

  // ─── Leave balance (tasks 29-31) ─────────────────────────────────────

  async getLeaveBalance(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { staffId, status: 'APPROVED', startDate: { gte: yearStart } },
    });
    const used: Record<string, number> = {};
    for (const l of leaves) {
      const days = Math.max(
        1,
        Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (24 * 3600 * 1000)) + 1,
      );
      used[l.type] = (used[l.type] ?? 0) + days;
    }
    const out: Record<string, { used: number; total: number }> = {};
    for (const [k, total] of Object.entries(LEAVE_ENTITLEMENTS)) {
      out[k] = { used: used[k] ?? 0, total };
    }
    return out;
  }

  // ─── Documents, salary, emergency contact (tasks 41-46) ─────────────

  async getMyDocuments(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    const staff = await this.prisma.staffMember.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    const docs: Array<{ id: string; type: string; url: string; uploadedAt: Date; status: string }> = [];
    if (staff?.salaryStructure) {
      const ss = staff.salaryStructure as Record<string, any>;
      if (ss['idProofUrl']) {
        docs.push({ id: `${staffId}_idproof`, type: 'ID_PROOF', url: ss['idProofUrl'], uploadedAt: staff.createdAt, status: 'UPLOADED' });
      }
      if (ss['addressProofUrl']) {
        docs.push({ id: `${staffId}_addressproof`, type: 'ADDRESS_PROOF', url: ss['addressProofUrl'], uploadedAt: staff.createdAt, status: 'UPLOADED' });
      }
    }
    return docs;
  }

  async getDocumentUploadUrl(userId: string, dto: { type: string; contentType?: string }) {
    const staffId = await this.resolveStaffId(userId);
    return this.s3.getPresignedUploadUrl(`staff/${staffId}/documents/${dto.type}`, dto.contentType);
  }

  async getSalarySlips(userId: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.prisma.salarySlip.findMany({
      where: { staffId },
      orderBy: { period: 'desc' },
    });
  }

  async getEmergencyContact(userId: string) {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.emergencyContact ?? null;
  }

  async updateEmergencyContact(
    userId: string,
    dto: { name: string; phone: string; relation?: string },
  ) {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return this.prisma.staffMember.update({
      where: { id: staff.id },
      data: { emergencyContact: dto as any },
    });
  }

  async getNotices(userId: string) {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return this.prisma.staffNotice.findMany({
      where: { societyId: staff.societyId, publishedAt: { not: null } },
      orderBy: [{ pinnedUntil: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }],
    });
  }

  // ─── Presigned URL + device token helpers ───────────────────────────

  async getCheckInVoiceUploadUrl(userId: string, contentType?: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.s3.getPresignedUploadUrl(`staff/${staffId}/check-in/voice`, contentType ?? 'audio/m4a');
  }

  async getProfilePhotoUploadUrl(userId: string, contentType?: string) {
    const staffId = await this.resolveStaffId(userId);
    return this.s3.getPresignedUploadUrl(`staff/${staffId}/profile`, contentType ?? 'image/jpeg');
  }

  async confirmProfilePhoto(userId: string, key: string) {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    // TODO: persist profile photo URL once StaffMember has a dedicated column.
    const url = this.s3.getPublicUrl(key);
    return { ok: true, url };
  }

  async confirmDocumentUpload(
    userId: string,
    body: { documentId?: string; key: string; type?: string },
  ) {
    // TODO: persist document metadata once StaffDocument model lands.
    await this.resolveStaffId(userId);
    return { ok: true, key: body.key, documentId: body.documentId ?? null };
  }

  async registerDevice(userId: string, token: string, _platform: 'ios' | 'android') {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
    return { ok: true };
  }

  async getSocietyGeofence(userId: string) {
    const staff = await this.prisma.staffMember.findUnique({
      where: { userId },
      include: { society: true },
    });
    if (!staff || !staff.society) {
      return { id: null, name: null, geofence: null, geofenceRadius: null };
    }
    return {
      id: staff.society.id,
      name: staff.society.name,
      geofence: (staff.society as any).geofence,
      geofenceRadius: (staff.society as any).geofenceRadius,
    };
  }
}
