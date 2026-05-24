import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsArray, IsNumber, IsDateString, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus } from '@prisma/client';

export class CreateServiceRequestDto {
  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'Morning (9–12)' })
  @IsString()
  @IsOptional()
  preferredTime?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({ description: 'Minutes before scheduledTime to send reminder' })
  @IsOptional()
  @IsInt()
  @Min(1)
  reminderMinutes?: number;

  @ApiPropertyOptional({ description: 'ISO datetime for scheduled arrival' })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

export class AdminCreateServiceRequestDto {
  @ApiProperty({ description: 'Resident ID (not user ID)' })
  @IsString()
  residentId: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  reminderMinutes?: number;
}

export class AdminUpdateServiceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  reminderMinutes?: number;
}

export class UpdateServiceRequestTagsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

export class RaiseDisputeDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class AssignWithScheduleDto {
  @ApiProperty({ description: 'Primary staff member ID (legacy single assign)' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ type: [String], description: 'One or more staff member IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  staffIds?: string[];

  @ApiPropertyOptional({ description: 'ISO datetime when staff is scheduled to arrive' })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

export class UpdateServiceRequestStatusDto {
  @ApiProperty({ enum: ServiceRequestStatus })
  @IsEnum(ServiceRequestStatus)
  status: ServiceRequestStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedToIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adminNote?: string;

  @ApiPropertyOptional({ description: 'Required when moving to REJECTED (staff/admin reason).' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RateServiceRequestDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

const PHOTO_PHASES = ['BEFORE', 'DURING', 'AFTER', 'DISPUTE'] as const;

export class ServicePhotoUploadQueryDto {
  @ApiProperty({ enum: PHOTO_PHASES })
  @IsIn([...PHOTO_PHASES])
  phase: (typeof PHOTO_PHASES)[number];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contentType?: string;
}

export class ConfirmServicePhotoDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty({ enum: PHOTO_PHASES })
  @IsIn([...PHOTO_PHASES])
  phase: (typeof PHOTO_PHASES)[number];

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

export class AddServiceTaskNoteDto {
  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'S3 object key after voice-upload-url flow' })
  @IsString()
  @IsOptional()
  voiceUrl?: string;
}

export class CompleteServiceRequestDto {
  @ApiProperty({ type: [String], description: 'S3 keys from photo-upload-url uploads' })
  @IsArray()
  @IsString({ each: true })
  photoUrls: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DisputeResponseDto {
  @ApiProperty()
  @IsString()
  response: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

export class ProofServiceRequestDto {
  @ApiProperty({ description: 'S3 object key after photo upload' })
  @IsString()
  photoUrl: string;

  @ApiPropertyOptional({ enum: ['BEFORE'] })
  @IsOptional()
  @IsIn(['BEFORE'])
  phase?: 'BEFORE';
}
