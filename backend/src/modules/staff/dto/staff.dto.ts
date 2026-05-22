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

export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsString()
  reason: string;
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
