import { BadRequestException, Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { PushService } from '../../common/notification/push.service';

@Injectable()
export class MedicalService {
  private readonly logger = new Logger(MedicalService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async getDoctors(societyId: string) {
    const doctors = await this.prisma.medicalStaff.findMany({
      where: { societyId, isAvailable: true },
    });

    return doctors.map((doctor) => ({
      ...doctor,
      specialization: doctor.designation,
      qualifications:
        typeof doctor.schedule === 'object' &&
        doctor.schedule &&
        !Array.isArray(doctor.schedule) &&
        'qualifications' in doctor.schedule
          ? (doctor.schedule as Record<string, unknown>).qualifications
          : 'Visiting doctor',
      availableDays:
        typeof doctor.schedule === 'object' &&
        doctor.schedule &&
        !Array.isArray(doctor.schedule) &&
        Array.isArray((doctor.schedule as Record<string, unknown>).availableDays)
          ? (doctor.schedule as Record<string, string[]>).availableDays
          : ['Mon', 'Wed', 'Fri'],
    }));
  }

  async getSlots(doctorId: string, date: string) {
    const doctor = await this.prisma.medicalStaff.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const booked = await this.prisma.appointment.findMany({
      where: { doctorId, date: new Date(date) },
      select: { timeSlot: true },
    });
    const bookedSlots = booked.map((a) => a.timeSlot);

    const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];
    return allSlots.map((slot) => ({ timeSlot: slot, available: !bookedSlots.includes(slot) }));
  }

  async bookAppointment(userId: string, doctorId: string, date: string, timeSlot: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const existing = await this.prisma.appointment.findUnique({
      where: { doctorId_date_timeSlot: { doctorId, date: new Date(date), timeSlot } },
    });
    if (existing) throw new ConflictException('Slot already booked');

    const appointment = await this.prisma.appointment.create({
      data: { residentId: resident.id, doctorId, date: new Date(date), timeSlot },
      include: { doctor: { select: { name: true } } },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Appointment confirmed',
          body: `Your appointment with ${appointment.doctor?.name ?? 'the doctor'} on ${appointment.date.toLocaleDateString('en-IN')} at ${timeSlot} is confirmed.`,
          category: 'community',
          collapseKey: `appointment:${appointment.id}`,
        },
        { type: 'APPOINTMENT_CONFIRMED', entityId: appointment.id, appointmentId: appointment.id },
      )
      .catch((e) => this.logger.warn(`appointment confirm push failed id=${appointment.id}: ${(e as Error).message}`));

    return appointment;
  }

  async cancelAppointment(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });

    if (!appointment || appointment.residentId !== resident.id) {
      throw new NotFoundException('Appointment not found');
    }

    const cancelled = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: 'Cancelled by resident' },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Appointment cancelled',
          body: `Your appointment on ${cancelled.date.toLocaleDateString('en-IN')} at ${cancelled.timeSlot} has been cancelled.`,
          category: 'community',
          collapseKey: `appointment:${cancelled.id}`,
        },
        { type: 'APPOINTMENT_CANCELLED', entityId: cancelled.id, appointmentId: cancelled.id },
      )
      .catch((e) => this.logger.warn(`appointment cancel push failed id=${cancelled.id}: ${(e as Error).message}`));

    return cancelled;
  }

  async rescheduleAppointment(id: string, userId: string, date: string, timeSlot: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.residentId !== resident.id) {
      throw new NotFoundException('Appointment not found');
    }
    const clash = await this.prisma.appointment.findUnique({
      where: { doctorId_date_timeSlot: { doctorId: appointment.doctorId, date: new Date(date), timeSlot } },
    });
    if (clash && clash.id !== id) throw new ConflictException('Slot already booked');
    const rescheduled = await this.prisma.appointment.update({
      where: { id },
      data: { date: new Date(date), timeSlot, status: 'BOOKED' },
    });

    void this.push
      .send(
        userId,
        {
          title: 'Appointment rescheduled',
          body: `Your appointment is now on ${rescheduled.date.toLocaleDateString('en-IN')} at ${rescheduled.timeSlot}.`,
          category: 'community',
          collapseKey: `appointment:${rescheduled.id}`,
        },
        { type: 'APPOINTMENT_RESCHEDULED', entityId: rescheduled.id, appointmentId: rescheduled.id },
      )
      .catch((e) => this.logger.warn(`appointment reschedule push failed id=${rescheduled.id}: ${(e as Error).message}`));

    return rescheduled;
  }

  async rateAppointment(id: string, userId: string, rating: number, comment?: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.residentId !== resident.id) {
      throw new NotFoundException('Appointment not found');
    }
    return this.prisma.appointment.update({
      where: { id },
      data: { rating, ratingText: comment ?? null },
    });
  }

  async getMyAppointments(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    const appointments = await this.prisma.appointment.findMany({
      where: { residentId: resident.id },
      include: { doctor: true },
      orderBy: { date: 'desc' },
    });

    return appointments.map((appointment) => ({
      ...appointment,
      doctor: {
        ...appointment.doctor,
        specialization: appointment.doctor.designation,
      },
    }));
  }

  async getDoctorById(doctorId: string, societyId: string) {
    const doctor = await this.prisma.medicalStaff.findFirst({
      where: { id: doctorId, societyId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const schedule = (typeof doctor.schedule === 'object' && doctor.schedule && !Array.isArray(doctor.schedule))
      ? (doctor.schedule as Record<string, unknown>)
      : {};

    return {
      ...doctor,
      specialization: doctor.designation,
      qualifications: schedule.qualifications ?? 'Visiting doctor',
      availableDays: Array.isArray(schedule.availableDays) ? schedule.availableDays : ['Mon', 'Wed', 'Fri'],
      timeSlots: Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [],
      bio: schedule.bio ?? null,
    };
  }

  async getAppointmentById(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true },
    });
    if (!appointment || appointment.residentId !== resident.id) {
      throw new NotFoundException('Appointment not found');
    }
    return {
      ...appointment,
      doctor: { ...appointment.doctor, specialization: appointment.doctor.designation },
    };
  }

  async getEmergencyContacts(societyId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { societyId },
      orderBy: { priority: 'asc' },
    });
  }

  // ── Doctor methods ───────────────────────────────────────────────────────────

  private async findMedicalStaffByUserId(userId: string) {
    const staffMember = await this.prisma.staffMember.findFirst({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    if (!staffMember) throw new NotFoundException('Staff member not found');
    const userName = staffMember.user?.name;
    const found = userName
      ? await this.prisma.medicalStaff.findFirst({
          where: { societyId: staffMember.societyId, name: userName },
        })
      : null;
    if (!found) throw new NotFoundException('Doctor profile not found for this account');
    return found;
  }

  async getDoctorAppointments(userId: string) {
    const staff = await this.findMedicalStaffByUserId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.appointment.findMany({
      where: {
        doctorId: staff.id,
        date: { gte: today },
        status: { not: 'CANCELLED' },
      },
      include: { resident: { include: { user: true } } },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    });
  }

  async toggleDoctorAvailability(userId: string) {
    const staff = await this.findMedicalStaffByUserId(userId);
    return this.prisma.medicalStaff.update({
      where: { id: staff.id },
      data: { isAvailable: !staff.isAvailable },
    });
  }

  async setDoctorSlots(userId: string, dto: { availableDays: string[]; timeSlots: string[] }) {
    const staff = await this.findMedicalStaffByUserId(userId);
    const existing = (typeof staff.schedule === 'object' && staff.schedule && !Array.isArray(staff.schedule))
      ? (staff.schedule as Record<string, unknown>)
      : {};
    return this.prisma.medicalStaff.update({
      where: { id: staff.id },
      data: { schedule: { ...existing, availableDays: dto.availableDays, timeSlots: dto.timeSlots } },
    });
  }

  async completeAppointment(id: string, userId: string) {
    const staff = await this.findMedicalStaffByUserId(userId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.doctorId !== staff.id) throw new NotFoundException('Appointment not found');
    return this.prisma.appointment.update({ where: { id }, data: { status: 'COMPLETED' } });
  }

  async addAppointmentNotes(id: string, userId: string, notes: string) {
    const staff = await this.findMedicalStaffByUserId(userId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.doctorId !== staff.id) throw new NotFoundException('Appointment not found');
    return this.prisma.appointment.update({ where: { id }, data: { notes } });
  }

  // ── Admin methods ────────────────────────────────────────────────────────────

  async createMedicalStaff(
    societyId: string,
    dto: { name: string; designation: string; availableDays?: string[]; timeSlots?: string[] },
  ) {
    const { availableDays, timeSlots, ...rest } = dto;
    return this.prisma.medicalStaff.create({
      data: {
        societyId,
        ...rest,
        schedule: { availableDays: availableDays ?? [], timeSlots: timeSlots ?? [] },
      },
    });
  }

  async updateMedicalStaff(id: string, dto: any) {
    return this.prisma.medicalStaff.update({ where: { id }, data: dto });
  }

  async deleteMedicalStaff(id: string) {
    return this.prisma.medicalStaff.update({ where: { id }, data: { isAvailable: false } });
  }

  async getAdminAppointments(societyId: string, date?: string, doctorId?: string) {
    return this.prisma.appointment.findMany({
      where: {
        doctor: { societyId },
        ...(date ? { date: new Date(date) } : {}),
        ...(doctorId ? { doctorId } : {}),
      },
      include: {
        doctor: true,
        resident: { include: { user: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getAdminMedicalStaffById(id: string, societyId: string) {
    const doctor = await this.prisma.medicalStaff.findFirst({
      where: { id, societyId },
    });
    if (!doctor) throw new NotFoundException('Medical staff not found');

    const schedule =
      typeof doctor.schedule === 'object' && doctor.schedule && !Array.isArray(doctor.schedule)
        ? (doctor.schedule as Record<string, unknown>)
        : {};

    return {
      ...doctor,
      specialization: doctor.designation,
      qualifications: schedule.qualifications ?? 'Visiting doctor',
      availableDays: Array.isArray(schedule.availableDays)
        ? (schedule.availableDays as string[])
        : ['Mon', 'Wed', 'Fri'],
      timeSlots: Array.isArray(schedule.timeSlots) ? (schedule.timeSlots as string[]) : [],
      bio: schedule.bio ?? null,
    };
  }

  async getAdminMedicalStaffRatings(id: string, societyId: string) {
    const doctor = await this.prisma.medicalStaff.findFirst({ where: { id, societyId } });
    if (!doctor) throw new NotFoundException('Medical staff not found');

    const rated = await this.prisma.appointment.findMany({
      where: { doctorId: id, rating: { not: null } },
      include: { resident: { include: { user: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const a of rated) {
      const r = Math.round(Number(a.rating)) as 1 | 2 | 3 | 4 | 5;
      if (r >= 1 && r <= 5) distribution[r]++;
      sum += Number(a.rating);
    }
    const count = rated.length;
    const avg = count === 0 ? 0 : sum / count;

    return {
      avg,
      count,
      distribution,
      recent: rated.slice(0, 10).map((a) => ({
        rating: Number(a.rating),
        comment: a.ratingText ?? null,
        residentName: a.resident?.user?.name ?? 'Resident',
        createdAt: a.updatedAt,
      })),
    };
  }

  async adminUpdateAppointment(
    id: string,
    societyId: string,
    dto: { status: AppointmentStatus; notes?: string },
  ) {
    const allowed: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Invalid status');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: { id, doctor: { societyId } },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async getSosLog(societyId: string) {
    // SosAlert.resident is the User (relation alias). Look up flat via the
    // Resident profile by userId, batched with a single query.
    const alerts = await this.prisma.sosAlert.findMany({
      where: { societyId },
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
    });
    const userIds = alerts.map((a) => a.residentId);
    const ackIds = alerts.map((a) => a.acknowledgedBy).filter((v): v is string => !!v);
    const [profiles, ackUsers] = await Promise.all([
      userIds.length
        ? this.prisma.resident.findMany({
            where: { userId: { in: userIds } },
            include: { flat: { select: { number: true, block: true } } },
          })
        : Promise.resolve([]),
      ackIds.length
        ? this.prisma.user.findMany({ where: { id: { in: ackIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const flatByUserId = new Map(profiles.map((p) => [p.userId, p.flat]));
    const ackNameById = new Map(ackUsers.map((u) => [u.id, u.name]));
    return alerts.map((a) => {
      const flat = flatByUserId.get(a.residentId);
      return {
        id: a.id,
        residentName: a.resident?.name ?? null,
        flat: flat ? `${flat.block ? flat.block + '-' : ''}${flat.number}` : null,
        alertTime: a.createdAt,
        acknowledgedBy: a.acknowledgedBy ? ackNameById.get(a.acknowledgedBy) ?? null : null,
        acknowledgedAt: a.acknowledgedAt,
        resolvedAt: a.resolvedAt,
        responseTimeSecs: a.responseTimeSecs,
        status: a.status,
        note: a.note,
      };
    });
  }
}
