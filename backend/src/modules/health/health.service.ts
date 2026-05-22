import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { CreateVitalDto, CreateMedicationDto, UpdateMedicationDto, CreateHealthRecordDto } from './dto/health.dto';
import { HealthVitalType } from '@prisma/client';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  private assertVitalPlausible(type: HealthVitalType, value: number, _unit: string) {
    const range = (min: number, max: number, hint: string) => {
      if (value < min || value > max) {
        throw new BadRequestException({
          code: 'VITAL_OUT_OF_RANGE',
          message: `Value outside expected range for ${type} (${hint})`,
          min,
          max,
        });
      }
    };

    switch (type) {
      case HealthVitalType.BP_SYSTOLIC:
        range(60, 250, 'typical mmHg');
        break;
      case HealthVitalType.BP_DIASTOLIC:
        range(40, 150, 'typical mmHg');
        break;
      case HealthVitalType.BLOOD_SUGAR:
        range(20, 600, 'plausible glucose reading');
        break;
      case HealthVitalType.WEIGHT:
        range(1, 400, 'kg or convert before submit');
        break;
      case HealthVitalType.SPO2:
        range(50, 100, 'percent');
        break;
      case HealthVitalType.HEART_RATE:
        range(30, 250, 'bpm');
        break;
      default:
        break;
    }
  }

  private assertRecordedAtReasonable(recordedAt: Date) {
    const now = Date.now();
    const t = recordedAt.getTime();
    if (Number.isNaN(t)) {
      throw new BadRequestException({ code: 'INVALID_RECORDED_AT', message: 'Invalid recordedAt timestamp' });
    }
    if (t > now + 5 * 60 * 1000) {
      throw new BadRequestException({
        code: 'FUTURE_RECORDING',
        message: 'Recording time cannot be more than 5 minutes in the future',
      });
    }
    const tenYearsMs = 10 * 365.25 * 24 * 3600 * 1000;
    if (t < now - tenYearsMs) {
      throw new BadRequestException({
        code: 'STALE_RECORDING',
        message: 'Recording time is too far in the past',
      });
    }
  }

  // ── Vitals ──────────────────────────────────────────────────────────────────

  async createVital(userId: string, dto: CreateVitalDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const recordedAt = new Date(dto.recordedAt);
    this.assertRecordedAtReasonable(recordedAt);
    this.assertVitalPlausible(dto.type, dto.value, dto.unit);
    return this.prisma.healthVital.create({
      data: {
        residentId: resident.id,
        type: dto.type,
        value: dto.value,
        unit: dto.unit,
        notes: dto.notes,
        recordedAt,
      },
    });
  }

  async getVitals(userId: string, type?: HealthVitalType, from?: string, to?: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.healthVital.findMany({
      where: {
        residentId: resident.id,
        ...(type && { type }),
        ...(from || to
          ? {
              recordedAt: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getVitalsSummary(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const types = Object.values(HealthVitalType);
    const results = await Promise.all(
      types.map((type) =>
        this.prisma.healthVital.findFirst({
          where: { residentId: resident.id, type },
          orderBy: { recordedAt: 'desc' },
        }),
      ),
    );
    return results.filter(Boolean);
  }

  // ── Medications ─────────────────────────────────────────────────────────────

  async createMedication(userId: string, dto: CreateMedicationDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.medication.create({
      data: {
        residentId: resident.id,
        name: dto.name,
        dosage: dto.dosage,
        frequency: dto.frequency,
        reminderTimes: dto.reminderTimes ?? [],
      },
    });
  }

  async getMedications(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.medication.findMany({
      where: { residentId: resident.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMedicationsToday(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const medications = await this.prisma.medication.findMany({
      where: { residentId: resident.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const slotHour = (h: number) => {
      if (h >= 6 && h < 12) return 'morning';
      if (h >= 12 && h < 17) return 'afternoon';
      if (h >= 17 && h < 21) return 'evening';
      return 'night';
    };

    const slots: Record<string, { medicationId: string; name: string; dosage: string; time: string; taken: boolean }[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    for (const med of medications) {
      const times = Array.isArray(med.reminderTimes) ? (med.reminderTimes as string[]) : [];
      if (times.length === 0) {
        slots.morning.push({ medicationId: med.id, name: med.name, dosage: med.dosage, time: '08:00', taken: false });
      } else {
        for (const t of times) {
          const hour = parseInt(t.split(':')[0] ?? '8', 10);
          const slot = slotHour(isNaN(hour) ? 8 : hour);
          slots[slot].push({ medicationId: med.id, name: med.name, dosage: med.dosage, time: t, taken: false });
        }
      }
    }

    return slots;
  }

  async toggleMedicationDose(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const med = await this.prisma.medication.findUnique({ where: { id } });
    if (!med || med.residentId !== resident.id) throw new NotFoundException('Medication not found');
    return this.prisma.medication.update({
      where: { id },
      data: { isActive: !med.isActive },
    });
  }

  async updateMedication(id: string, userId: string, dto: UpdateMedicationDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const med = await this.prisma.medication.findUnique({ where: { id } });
    if (!med || med.residentId !== resident.id) throw new NotFoundException('Medication not found');
    return this.prisma.medication.update({ where: { id }, data: dto });
  }

  async deleteMedication(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const med = await this.prisma.medication.findUnique({ where: { id } });
    if (!med || med.residentId !== resident.id) throw new NotFoundException('Medication not found');
    return this.prisma.medication.delete({ where: { id } });
  }

  // ── Health Records ───────────────────────────────────────────────────────────

  async createRecord(userId: string, dto: CreateHealthRecordDto) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.healthRecord.create({
      data: {
        residentId: resident.id,
        type: dto.type,
        title: dto.title,
        fileUrl: dto.fileUrl,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });
  }

  async getRecords(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.healthRecord.findMany({
      where: { residentId: resident.id },
      orderBy: { date: 'desc' },
    });
  }

  async getToday(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    // Latest reading per type for vitals summary
    const types = Object.values(HealthVitalType);
    const latest = await Promise.all(
      types.map((type) =>
        this.prisma.healthVital.findFirst({
          where: { residentId: resident.id, type },
          orderBy: { recordedAt: 'desc' },
        }),
      ),
    );
    const byType = new Map(latest.filter(Boolean).map((v) => [v!.type, v!]));
    const sys = byType.get(HealthVitalType.BP_SYSTOLIC);
    const dia = byType.get(HealthVitalType.BP_DIASTOLIC);
    const sugar = byType.get(HealthVitalType.BLOOD_SUGAR);
    const weight = byType.get(HealthVitalType.WEIGHT);
    const spo2 = byType.get(HealthVitalType.SPO2);

    const vitals: any = {};
    if (sys && dia) {
      vitals.bp = {
        systolic: Number(sys.value),
        diastolic: Number(dia.value),
        recordedAt: sys.recordedAt,
      };
    }
    if (sugar) vitals.sugar = { value: Number(sugar.value), recordedAt: sugar.recordedAt };
    if (weight) vitals.weight = { value: Number(weight.value), recordedAt: weight.recordedAt };
    if (spo2) vitals.spo2 = { value: Number(spo2.value), recordedAt: spo2.recordedAt };

    // Today's medication slots flattened to a list
    const meds = await this.prisma.medication.findMany({
      where: { residentId: resident.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const medications: { id: string; name: string; dosage: string; time: string; taken: boolean }[] = [];
    for (const med of meds) {
      const times = Array.isArray(med.reminderTimes) ? (med.reminderTimes as string[]) : [];
      if (times.length === 0) {
        medications.push({ id: med.id, name: med.name, dosage: med.dosage, time: '08:00', taken: false });
      } else {
        for (const t of times) {
          medications.push({ id: med.id, name: med.name, dosage: med.dosage, time: t, taken: false });
        }
      }
    }

    return { vitals, medications };
  }

  async getVitalsByType(userId: string, type: string, days?: number) {
    const resident = await requireResidentByUserId(this.prisma, userId);

    const ALIAS: Record<string, HealthVitalType[]> = {
      bp: [HealthVitalType.BP_SYSTOLIC, HealthVitalType.BP_DIASTOLIC],
      sugar: [HealthVitalType.BLOOD_SUGAR],
      weight: [HealthVitalType.WEIGHT],
      spo2: [HealthVitalType.SPO2],
      heart_rate: [HealthVitalType.HEART_RATE],
      bp_systolic: [HealthVitalType.BP_SYSTOLIC],
      bp_diastolic: [HealthVitalType.BP_DIASTOLIC],
    };
    const key = type.toLowerCase();
    let queryTypes = ALIAS[key];
    if (!queryTypes) {
      const upper = type.toUpperCase() as HealthVitalType;
      if (!Object.values(HealthVitalType).includes(upper)) {
        throw new BadRequestException(`Unknown vital type: ${type}`);
      }
      queryTypes = [upper];
    }

    const since = days ? new Date(Date.now() - days * 86400000) : undefined;

    const readings = await this.prisma.healthVital.findMany({
      where: {
        residentId: resident.id,
        type: { in: queryTypes },
        ...(since ? { recordedAt: { gte: since } } : {}),
      },
      orderBy: { recordedAt: 'desc' },
    });

    const values = readings.map((r) => Number(r.value));
    const stats = values.length
      ? {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
        }
      : { min: 0, max: 0, avg: 0 };

    return {
      readings: readings.map((r) => ({
        id: r.id,
        value: String(Number(r.value)),
        unit: r.unit,
        recordedAt: r.recordedAt,
        notes: r.notes ?? undefined,
      })),
      chart: [...values].reverse(),
      stats,
      unit: readings[0]?.unit ?? '',
    };
  }

  async getRecord(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const record = await this.prisma.healthRecord.findUnique({ where: { id } });
    if (!record || record.residentId !== resident.id) throw new NotFoundException('Record not found');

    const lower = (record.fileUrl ?? '').toLowerCase();
    const fileType: 'pdf' | 'image' = lower.endsWith('.pdf') ? 'pdf' : 'image';

    return {
      id: record.id,
      name: record.title,
      type: record.type,
      date: record.date,
      uploadedAt: record.createdAt,
      fileType,
      url: record.fileUrl,
    };
  }

  async getRecordUrl(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const record = await this.prisma.healthRecord.findUnique({ where: { id } });
    if (!record || record.residentId !== resident.id) throw new NotFoundException('Record not found');
    return { fileUrl: record.fileUrl };
  }

  async deleteRecord(id: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const record = await this.prisma.healthRecord.findUnique({ where: { id } });
    if (!record || record.residentId !== resident.id) throw new NotFoundException('Record not found');
    return this.prisma.healthRecord.delete({ where: { id } });
  }
}
