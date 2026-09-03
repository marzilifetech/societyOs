import { BadRequestException } from '@nestjs/common';
import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsInt, Min, Max, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum LeaveType {
  CASUAL = 'CASUAL',
  MEDICAL = 'MEDICAL',
  PRIVILEGE = 'PRIVILEGE',
  SICK = 'SICK',
  ANNUAL = 'ANNUAL',
  EMERGENCY = 'EMERGENCY',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Apply for leave.
 *
 * The staff app posts `{ leaveType, fromDate, toDate, reason }` — it copied the
 * shape of the ADMIN leave-list RESPONSE, which renames these fields. This DTO
 * only declared `{ type, startDate, endDate }`, and the global ValidationPipe
 * runs with `forbidNonWhitelisted: true`, so every submission was rejected with
 * `400 property leaveType should not exist`: the "Submit request is not
 * functional" report.
 *
 * Both spellings are accepted. Doing this server-side matters because app
 * builds already in users' hands cannot be force-updated — they start working
 * the moment this ships. `resolveLeaveFields` picks the canonical values.
 */
export class CreateLeaveRequestDto {
  @ApiPropertyOptional({ enum: LeaveType, description: 'Alias of `leaveType`.' })
  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;

  @ApiPropertyOptional({ enum: LeaveType, description: 'Alias of `type`.' })
  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @ApiPropertyOptional({ description: 'Alias of `fromDate`.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Alias of `startDate`.' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Alias of `toDate`.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Alias of `endDate`.' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty()
  @IsString()
  reason: string;
}

/** Collapses the accepted aliases into the canonical leave fields. */
export function resolveLeaveFields(dto: CreateLeaveRequestDto): {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
} {
  const type = dto.type ?? dto.leaveType;
  const startDate = dto.startDate ?? dto.fromDate;
  const endDate = dto.endDate ?? dto.toDate;
  const missing: string[] = [];
  if (!type) missing.push('type');
  if (!startDate) missing.push('startDate');
  if (!endDate) missing.push('endDate');
  if (missing.length) {
    throw new BadRequestException({
      code: 'LEAVE_FIELDS_MISSING',
      message: `Missing required leave field(s): ${missing.join(', ')}`,
    });
  }
  return { type: type as LeaveType, startDate: startDate!, endDate: endDate!, reason: dto.reason };
}

export class UpdateLeaveStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class AttendanceQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;
}

export class CheckInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  biometricVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class LateReasonDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voiceUrl?: string;
}

export class ShiftRangeDto {
  @ApiPropertyOptional({ enum: ['today', 'week', 'upcoming'] })
  @IsOptional()
  @IsEnum(['today', 'week', 'upcoming'])
  range?: 'today' | 'week' | 'upcoming';
}

export class HolidayQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class CreateHolidayDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}

export class RejectTaskDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class AddTaskNoteDto {
  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voiceUrl?: string;
}

export class PresignedUploadQueryDto {
  @ApiProperty({ enum: ['BEFORE', 'DURING', 'AFTER'] })
  @IsEnum(['BEFORE', 'DURING', 'AFTER'])
  phase: 'BEFORE' | 'DURING' | 'AFTER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class ConfirmTaskPhotoDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty({ enum: ['BEFORE', 'DURING', 'AFTER'] })
  @IsEnum(['BEFORE', 'DURING', 'AFTER'])
  phase: 'BEFORE' | 'DURING' | 'AFTER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  takenAt?: string;
}

export class TaskHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

export class FlagReviewDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class EmergencyContactDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relation?: string;
}

export class DocumentUploadDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string;
}

export enum LeaderboardPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LeaderboardPeriod, default: LeaderboardPeriod.MONTH })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod;
}
